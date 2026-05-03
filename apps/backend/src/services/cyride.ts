import axios from 'axios';
import { User } from '@cypilot/shared';
import { CyRideRoute, CyRideStop, CyRideTrip, CyRideVehicle, CyRideRoutePlan } from '@cypilot/shared';

interface LiveRoute {
  ID: number;
  Name: string;
  DisplayName: string;
  ShortName: string;
  Color: string;
  CustomerID: number;
}

interface LiveVehicle {
  ID: number;
  RouteId: number;
  Name: string;
  Latitude: number;
  Longitude: number;
  Speed: number;
  Heading: string | number;
  Updated?: string;
  APCPercentage?: number;
}

interface LiveStop {
  ID: number;
  Name: string;
  Latitude: number;
  Longitude: number;
}

interface LiveDirection {
  Stops?: LiveStop[];
}

interface LiveArrival {
  StopID: number;
  Minutes?: number | string;
  VehicleID: number;
}

interface LiveWaypoint {
  Latitude: number;
  Longitude: number;
}

interface GeocodeCandidate {
  display_name: string;
  lat: string;
  lon: string;
}

interface RouteCache {
  expiresAt: number;
  data: LiveRoute[];
}

interface RoutePlanCandidate {
  route: CyRideRoute;
  originStop: CyRideStop;
  destinationStop: CyRideStop;
  originWalkKm: number;
  destinationWalkKm: number;
  busDistanceKm: number;
  score: number;
}

class CyRideService {
  private liveBaseUrl = process.env.CYRIDE_LIVE_BASE_URL || 'https://www.mycyride.com';
  private defaultCustomerId = parseInt(process.env.CYRIDE_CUSTOMER_ID || '187', 10);
  private routeCache: RouteCache | null = null;
  private routeCacheTtlMs = 30 * 1000;

  private static DEFAULT_STOPS: CyRideStop[] = [
    {
      id: 'memorial-union',
      name: 'Memorial Union',
      description: 'Main student union building',
      latitude: 42.0267,
      longitude: -93.6479,
      routes: ['1', '2'],
      accessible: true,
      shelter: true,
    },
    {
      id: 'parks-library',
      name: 'Parks Library',
      description: 'ISU central library',
      latitude: 42.0288,
      longitude: -93.6457,
      routes: ['1', '3'],
      accessible: true,
      shelter: false,
    },
    {
      id: 'state-gym',
      name: 'State Gym',
      description: 'Campus recreation and transit point',
      latitude: 42.0253,
      longitude: -93.6527,
      routes: ['1', '2', '3'],
      accessible: true,
      shelter: true,
    },
  ];

  private api = axios.create({
    baseURL: this.liveBaseUrl,
    timeout: 10000,
    headers: {
      'User-Agent': 'cypilot-backend/1.0 (+https://github.com/cypilot)',
      Accept: 'application/json',
    },
  });

  private geocodeApi = axios.create({
    baseURL: 'https://nominatim.openstreetmap.org',
    timeout: 10000,
    headers: {
      'User-Agent': 'cypilot-backend/1.0 (+https://github.com/cypilot)',
      Accept: 'application/json',
    },
  });

  private headingToDegrees(heading: string | number): number {
    if (typeof heading === 'number') {
      return heading;
    }

    const normalized = heading.toUpperCase();
    const cardinalToDegrees: Record<string, number> = {
      N: 0,
      NE: 45,
      E: 90,
      SE: 135,
      S: 180,
      SW: 225,
      W: 270,
      NW: 315,
    };

    return cardinalToDegrees[normalized] ?? 0;
  }

  private apcToOccupancy(apcPercentage?: number): CyRideVehicle['occupancy'] {
    if (typeof apcPercentage !== 'number') {
      return undefined;
    }
    if (apcPercentage >= 70) {
      return 'high';
    }
    if (apcPercentage >= 35) {
      return 'medium';
    }
    return 'low';
  }

  private haversineDistanceKm(
    pointA: { lat: number; lng: number },
    pointB: { lat: number; lng: number },
  ): number {
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const deltaLat = toRadians(pointB.lat - pointA.lat);
    const deltaLng = toRadians(pointB.lng - pointA.lng);
    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(toRadians(pointA.lat)) *
        Math.cos(toRadians(pointB.lat)) *
        Math.sin(deltaLng / 2) *
        Math.sin(deltaLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  }

  private findClosestStop(stops: CyRideStop[], point: { lat: number; lng: number }) {
    let closest: CyRideStop | null = null;
    let minDistanceKm = Number.POSITIVE_INFINITY;

    for (const stop of stops) {
      const distanceKm = this.haversineDistanceKm(point, {
        lat: stop.latitude,
        lng: stop.longitude,
      });
      if (distanceKm < minDistanceKm) {
        minDistanceKm = distanceKm;
        closest = stop;
      }
    }

    return closest
      ? {
          stop: closest,
          distanceKm: minDistanceKm,
        }
      : null;
  }

  private estimateWalkingMinutes(distanceKm: number): number {
    const walkingSpeedKmPerHour = 5;
    return Math.max(1, Math.round((distanceKm / walkingSpeedKmPerHour) * 60));
  }

  private estimateBusMinutes(distanceKm: number): number {
    const averageBusSpeedKmPerHour = 22;
    return Math.max(6, Math.round((distanceKm / averageBusSpeedKmPerHour) * 60));
  }

  private mapLiveRoute(route: LiveRoute): CyRideRoute {
    return {
      id: String(route.ID),
      name: route.DisplayName || route.Name,
      description: `${route.ShortName || route.Name} service`,
      color: route.Color || '#0A66C2',
      type: 'bus',
      status: 'active',
      operatingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    };
  }

  private mapLiveVehicle(vehicle: LiveVehicle): CyRideVehicle {
    return {
      id: String(vehicle.ID),
      routeId: String(vehicle.RouteId),
      latitude: vehicle.Latitude,
      longitude: vehicle.Longitude,
      heading: this.headingToDegrees(vehicle.Heading),
      speed: vehicle.Speed || 0,
      lastUpdate: vehicle.Updated ? new Date().toISOString() : new Date().toISOString(),
      occupancy: this.apcToOccupancy(vehicle.APCPercentage),
    };
  }

  private async fetchLiveRoutes(forceRefresh = false): Promise<LiveRoute[]> {
    const now = Date.now();
    if (!forceRefresh && this.routeCache && this.routeCache.expiresAt > now) {
      return this.routeCache.data;
    }

    const response = await this.api.get<LiveRoute[]>('/Region/0/Routes');
    const routes = Array.isArray(response.data) ? response.data : [];
    this.routeCache = {
      data: routes,
      expiresAt: now + this.routeCacheTtlMs,
    };
    return routes;
  }

  private async fetchVehiclesForRoute(routeId: number): Promise<LiveVehicle[]> {
    const response = await this.api.get<LiveVehicle[]>(`/Route/${routeId}/Vehicles`);
    return Array.isArray(response.data) ? response.data : [];
  }

  private async fetchDirectionsForRoute(routeId: number): Promise<LiveDirection[]> {
    const response = await this.api.get<LiveDirection[]>(`/Route/${routeId}/Directions/`);
    return Array.isArray(response.data) ? response.data : [];
  }

  private async fetchWaypointsForRoute(routeId: number): Promise<LiveWaypoint[]> {
    const response = await this.api.get<LiveWaypoint[][]>(`/Route/${routeId}/Waypoints/`);
    const payload = response.data;
    if (!Array.isArray(payload)) {
      return [];
    }
    const nested = payload[0];
    return Array.isArray(nested) ? nested : [];
  }

  private async fetchArrivalsForVehicle(vehicleId: number, customerId: number): Promise<LiveArrival[]> {
    const response = await this.api.get<LiveArrival[]>(`/Vehicle/${vehicleId}/Arrivals`, {
      params: { customerID: customerId },
    });
    return Array.isArray(response.data) ? response.data : [];
  }

  async suggestAddresses(
    query: string,
    limit: number = 5,
  ): Promise<Array<{ name: string; latitude: number; longitude: number }>> {
    try {
      const normalizedQuery = query.trim();
      if (!normalizedQuery) {
        return [];
      }

      const safeLimit = Math.min(Math.max(limit, 1), 8);
      // Append "Ames, Iowa" to query to focus search on Ames area
      const amesQuery = `${normalizedQuery}, Ames, Iowa`;
      const response = await this.geocodeApi.get<GeocodeCandidate[]>('/search', {
        params: {
          q: amesQuery,
          format: 'jsonv2',
          limit: safeLimit,
          countrycodes: 'us',
          // Bounding box for Ames, Iowa area (viewbox: left,top,right,bottom)
          viewbox: '-93.75,42.10,-93.55,41.95',
          bounded: 1,
        },
      });

      const candidates = Array.isArray(response.data) ? response.data : [];
      return candidates
        .map((candidate) => {
          const latitude = parseFloat(candidate.lat);
          const longitude = parseFloat(candidate.lon);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return null;
          }
          return {
            name: candidate.display_name || normalizedQuery,
            latitude,
            longitude,
          };
        })
        .filter(
          (
            candidate,
          ): candidate is {
            name: string;
            latitude: number;
            longitude: number;
          } => candidate !== null,
        );
    } catch (error) {
      console.error('Error getting address suggestions:', error);
      return [];
    }
  }

  async geocodeAddress(
    query: string,
  ): Promise<{ name: string; latitude: number; longitude: number } | null> {
    const suggestions = await this.suggestAddresses(query, 1);
    return suggestions[0] || null;
  }

  async getDashboardData(user: User, accessToken: string) {
    const [favoriteRoutes, nearbyStops, upcomingTrips] = await Promise.allSettled([
      this.getFavoriteRoutes(user),
      this.getNearbyStops(user),
      this.getUpcomingTrips(user),
    ]);

    return {
      favoriteRoutes: favoriteRoutes.status === 'fulfilled' ? favoriteRoutes.value : [],
      nearbyStops: nearbyStops.status === 'fulfilled' ? nearbyStops.value : [],
      upcomingTrips: upcomingTrips.status === 'fulfilled' ? upcomingTrips.value : [],
    };
  }

  async getRoutes(): Promise<CyRideRoute[]> {
    try {
      const routes = await this.fetchLiveRoutes();
      return routes.map((route) => this.mapLiveRoute(route));
    } catch (error) {
      console.error('Error fetching CyRide routes:', error);
      return [
        {
          id: '1',
          name: '1 Red',
          description: 'Campus route',
          color: '#DA1F3D',
          type: 'bus',
          status: 'active',
          operatingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        },
        {
          id: '3',
          name: '3 Blue',
          description: 'Campus loop',
          color: '#1989CA',
          type: 'bus',
          status: 'active',
          operatingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        },
      ];
    }
  }

  async getFavoriteRoutes(user: User): Promise<CyRideRoute[]> {
    try {
      const routes = await this.getRoutes();
      const vehicles = await this.getVehicles();
      if (!vehicles.length) {
        return routes.slice(0, 3);
      }
      const activeRouteIds = new Set(vehicles.map((vehicle) => vehicle.routeId));
      const activeRoutes = routes.filter((route) => activeRouteIds.has(route.id));
      return activeRoutes.length ? activeRoutes.slice(0, 5) : routes.slice(0, 3);
    } catch (error) {
      console.error('Error fetching favorite routes:', error);
      return [];
    }
  }

  async getStops(routeId?: string): Promise<CyRideStop[]> {
    try {
      if (!routeId) {
        return CyRideService.DEFAULT_STOPS;
      }

      const parsedRouteId = parseInt(routeId, 10);
      if (Number.isNaN(parsedRouteId)) {
        return [];
      }

      const directions = await this.fetchDirectionsForRoute(parsedRouteId);
      const stopMap = new Map<number, CyRideStop>();
      for (const direction of directions) {
        const stops = direction.Stops || [];
        for (const stop of stops) {
          if (!stopMap.has(stop.ID)) {
            stopMap.set(stop.ID, {
              id: String(stop.ID),
              name: stop.Name,
              latitude: stop.Latitude,
              longitude: stop.Longitude,
              routes: [String(parsedRouteId)],
              accessible: true,
              shelter: undefined,
            });
          }
        }
      }
      return Array.from(stopMap.values());
    } catch (error) {
      console.error('Error fetching CyRide stops:', error);
      return routeId ? [] : CyRideService.DEFAULT_STOPS;
    }
  }

  async getNearbyStops(user: User, radius: number = 0.5): Promise<CyRideStop[]> {
    try {
      const stops = await this.getStops();
      return stops.slice(0, 8);
    } catch (error) {
      console.error('Error fetching nearby stops:', error);
      return [];
    }
  }

  async getUpcomingTrips(user: User): Promise<CyRideTrip[]> {
    try {
      const routes = await this.fetchLiveRoutes();
      const routeCustomerId = new Map<number, number>();
      routes.forEach((route) => routeCustomerId.set(route.ID, route.CustomerID || this.defaultCustomerId));

      const vehicles = await this.getVehicles();
      if (!vehicles.length) {
        return [];
      }

      const arrivalsResults = await Promise.allSettled(
        vehicles.slice(0, 12).map(async (vehicle) => {
          const customerId = routeCustomerId.get(Number(vehicle.routeId)) || this.defaultCustomerId;
          const arrivals = await this.fetchArrivalsForVehicle(Number(vehicle.id), customerId);
          const next = arrivals[0];
          if (!next) {
            return null;
          }

          const minutes =
            typeof next.Minutes === 'number'
              ? next.Minutes
              : parseInt(String(next.Minutes || '0'), 10);
          const safeMinutes = Number.isFinite(minutes) ? Math.max(minutes, 0) : 0;
          const predicted = new Date(Date.now() + safeMinutes * 60 * 1000);

          const status: CyRideTrip['status'] =
            safeMinutes >= 20 ? 'delayed' : safeMinutes === 0 ? 'on_time' : 'on_time';

          const trip: CyRideTrip = {
            id: `${vehicle.id}-${next.StopID}`,
            routeId: vehicle.routeId,
            stopId: String(next.StopID),
            scheduledArrival: predicted.toISOString(),
            predictedArrival: predicted.toISOString(),
            delay: safeMinutes >= 20 ? safeMinutes - 10 : 0,
            status,
            vehicleId: vehicle.id,
          };
          return trip;
        }),
      );

      const trips = arrivalsResults
        .filter((result): result is PromiseFulfilledResult<CyRideTrip | null> => result.status === 'fulfilled')
        .map((result) => result.value)
        .filter((trip): trip is CyRideTrip => Boolean(trip))
        .sort((a, b) => new Date(a.scheduledArrival).getTime() - new Date(b.scheduledArrival).getTime());

      return trips.slice(0, 20);
    } catch (error) {
      console.error('Error fetching upcoming trips:', error);
      return [];
    }
  }

  async getVehicles(routeId?: string): Promise<CyRideVehicle[]> {
    try {
      if (routeId) {
        const parsedRouteId = parseInt(routeId, 10);
        if (Number.isNaN(parsedRouteId)) {
          return [];
        }
        const routeVehicles = await this.fetchVehiclesForRoute(parsedRouteId);
        return routeVehicles.map((vehicle) => this.mapLiveVehicle(vehicle));
      }

      const routes = await this.fetchLiveRoutes();
      const vehiclesResults = await Promise.allSettled(
        routes.map((route) => this.fetchVehiclesForRoute(route.ID)),
      );

      const vehicles = vehiclesResults
        .filter((result): result is PromiseFulfilledResult<LiveVehicle[]> => result.status === 'fulfilled')
        .flatMap((result) => result.value);

      return vehicles.map((vehicle) => this.mapLiveVehicle(vehicle));
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      return [];
    }
  }

  async getRouteWaypoints(routeId: string): Promise<Array<{ latitude: number; longitude: number }>> {
    try {
      const parsedRouteId = parseInt(routeId, 10);
      if (Number.isNaN(parsedRouteId)) {
        return [];
      }
      const points = await this.fetchWaypointsForRoute(parsedRouteId);
      return points.map((point) => ({
        latitude: point.Latitude,
        longitude: point.Longitude,
      }));
    } catch (error) {
      console.error('Error fetching route waypoints:', error);
      return [];
    }
  }

  /**
   * Find all routes that serve a destination
   * Returns routes sorted by how close their stops are to the destination
   */
  async findRoutesToDestination(
    destination: { lat: number; lng: number },
    maxWalkingDistanceKm: number = 0.8, // ~10 min walk
  ): Promise<
    Array<{
      route: CyRideRoute;
      nearestStop: CyRideStop;
      walkingDistanceKm: number;
      walkingMinutes: number;
      vehicles: CyRideVehicle[];
      nextArrivalMinutes: number | null;
    }>
  > {
    const routes = await this.getRoutes();
    const results: Array<{
      route: CyRideRoute;
      nearestStop: CyRideStop;
      walkingDistanceKm: number;
      walkingMinutes: number;
      vehicles: CyRideVehicle[];
      nextArrivalMinutes: number | null;
    }> = [];

    // Check each route for stops near the destination
    const routeChecks = await Promise.allSettled(
      routes.map(async (route) => {
        const stops = await this.getStops(route.id);
        if (stops.length === 0) return null;

        const closest = this.findClosestStop(stops, destination);
        if (!closest || closest.distanceKm > maxWalkingDistanceKm) return null;

        // Get vehicles for this route
        const vehicles = await this.getVehicles(route.id);

        // Get next arrival time if vehicles exist
        let nextArrivalMinutes: number | null = null;
        if (vehicles.length > 0) {
          try {
            const liveRoutes = await this.fetchLiveRoutes();
            const liveRoute = liveRoutes.find((r) => String(r.ID) === route.id);
            const customerId = liveRoute?.CustomerID || this.defaultCustomerId;

            const arrivalsResults = await Promise.allSettled(
              vehicles.slice(0, 3).map(async (vehicle) => {
                const arrivals = await this.fetchArrivalsForVehicle(Number(vehicle.id), customerId);
                const relevantArrival = arrivals.find(
                  (a) => String(a.StopID) === closest.stop.id,
                );
                if (relevantArrival && relevantArrival.Minutes !== undefined) {
                  const minutes =
                    typeof relevantArrival.Minutes === 'number'
                      ? relevantArrival.Minutes
                      : parseInt(String(relevantArrival.Minutes), 10);
                  return Number.isFinite(minutes) ? minutes : null;
                }
                return null;
              }),
            );

            const validArrivals = arrivalsResults
              .filter(
                (r): r is PromiseFulfilledResult<number | null> => r.status === 'fulfilled',
              )
              .map((r) => r.value)
              .filter((m): m is number => m !== null);

            if (validArrivals.length > 0) {
              nextArrivalMinutes = Math.min(...validArrivals);
            }
          } catch {
            // Ignore arrival fetch errors
          }
        }

        return {
          route,
          nearestStop: closest.stop,
          walkingDistanceKm: closest.distanceKm,
          walkingMinutes: this.estimateWalkingMinutes(closest.distanceKm),
          vehicles,
          nextArrivalMinutes,
        };
      }),
    );

    for (const result of routeChecks) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      }
    }

    // Sort by: has vehicles first, then by walking distance
    return results.sort((a, b) => {
      // Prioritize routes with active vehicles
      const aHasVehicles = a.vehicles.length > 0 ? 0 : 1;
      const bHasVehicles = b.vehicles.length > 0 ? 0 : 1;
      if (aHasVehicles !== bHasVehicles) return aHasVehicles - bHasVehicles;

      // Then by arrival time if available
      if (a.nextArrivalMinutes !== null && b.nextArrivalMinutes !== null) {
        return a.nextArrivalMinutes - b.nextArrivalMinutes;
      }
      if (a.nextArrivalMinutes !== null) return -1;
      if (b.nextArrivalMinutes !== null) return 1;

      // Finally by walking distance
      return a.walkingDistanceKm - b.walkingDistanceKm;
    });
  }

  /**
   * Get today's active routes with live vehicle information
   * Shows routes that currently have active buses running
   */
  async getTodayActiveRoutes(): Promise<
    Array<{
      route: CyRideRoute;
      vehicleCount: number;
      vehicles: CyRideVehicle[];
    }>
  > {
    try {
      const routes = await this.getRoutes();
      const vehicles = await this.getVehicles();

      // Group vehicles by route
      const vehiclesByRoute = new Map<string, CyRideVehicle[]>();
      for (const vehicle of vehicles) {
        const existing = vehiclesByRoute.get(vehicle.routeId) || [];
        existing.push(vehicle);
        vehiclesByRoute.set(vehicle.routeId, existing);
      }

      // Build active routes list
      const activeRoutes = routes
        .map((route) => {
          const routeVehicles = vehiclesByRoute.get(route.id) || [];
          return {
            route,
            vehicleCount: routeVehicles.length,
            vehicles: routeVehicles,
          };
        })
        .filter((item) => item.vehicleCount > 0)
        .sort((a, b) => b.vehicleCount - a.vehicleCount);

      return activeRoutes;
    } catch (error) {
      console.error('Error fetching today active routes:', error);
      return [];
    }
  }

  /**
   * Find routes from user's origin to a destination
   * Returns routes with boarding/alighting stops and ETAs
   */
  async findRoutesFromOriginToDestination(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    maxWalkingDistanceKm: number = 0.8,
  ): Promise<
    Array<{
      route: CyRideRoute;
      boardingStop: CyRideStop;
      alightingStop: CyRideStop;
      originWalkKm: number;
      originWalkMinutes: number;
      destinationWalkKm: number;
      destinationWalkMinutes: number;
      vehicles: CyRideVehicle[];
      nextArrivalMinutes: number | null;
      totalTripMinutes: number;
    }>
  > {
    const routes = await this.getRoutes();
    const results: Array<{
      route: CyRideRoute;
      boardingStop: CyRideStop;
      alightingStop: CyRideStop;
      originWalkKm: number;
      originWalkMinutes: number;
      destinationWalkKm: number;
      destinationWalkMinutes: number;
      vehicles: CyRideVehicle[];
      nextArrivalMinutes: number | null;
      totalTripMinutes: number;
    }> = [];

    const routeChecks = await Promise.allSettled(
      routes.map(async (route) => {
        const stops = await this.getStops(route.id);
        if (stops.length < 2) return null;

        // Find closest stop to origin (boarding)
        const closestOrigin = this.findClosestStop(stops, origin);
        // Find closest stop to destination (alighting)
        const closestDestination = this.findClosestStop(stops, destination);

        if (!closestOrigin || !closestDestination) return null;

        // Check if both walking distances are acceptable
        if (
          closestOrigin.distanceKm > maxWalkingDistanceKm ||
          closestDestination.distanceKm > maxWalkingDistanceKm
        ) {
          return null;
        }

        // Get vehicles for this route
        const vehicles = await this.getVehicles(route.id);

        // Calculate walking times
        const originWalkMinutes = this.estimateWalkingMinutes(closestOrigin.distanceKm);
        const destinationWalkMinutes = this.estimateWalkingMinutes(closestDestination.distanceKm);

        // Estimate bus ride time
        const busDistanceKm = this.haversineDistanceKm(
          { lat: closestOrigin.stop.latitude, lng: closestOrigin.stop.longitude },
          { lat: closestDestination.stop.latitude, lng: closestDestination.stop.longitude },
        );
        const busMinutes = this.estimateBusMinutes(busDistanceKm);

        // Get next arrival time at boarding stop
        let nextArrivalMinutes: number | null = null;
        if (vehicles.length > 0) {
          try {
            const liveRoutes = await this.fetchLiveRoutes();
            const liveRoute = liveRoutes.find((r) => String(r.ID) === route.id);
            const customerId = liveRoute?.CustomerID || this.defaultCustomerId;

            const arrivalsResults = await Promise.allSettled(
              vehicles.slice(0, 3).map(async (vehicle) => {
                const arrivals = await this.fetchArrivalsForVehicle(Number(vehicle.id), customerId);
                const relevantArrival = arrivals.find(
                  (a) => String(a.StopID) === closestOrigin.stop.id,
                );
                if (relevantArrival && relevantArrival.Minutes !== undefined) {
                  const minutes =
                    typeof relevantArrival.Minutes === 'number'
                      ? relevantArrival.Minutes
                      : parseInt(String(relevantArrival.Minutes), 10);
                  return Number.isFinite(minutes) ? minutes : null;
                }
                return null;
              }),
            );

            const validArrivals = arrivalsResults
              .filter((r): r is PromiseFulfilledResult<number | null> => r.status === 'fulfilled')
              .map((r) => r.value)
              .filter((m): m is number => m !== null);

            if (validArrivals.length > 0) {
              nextArrivalMinutes = Math.min(...validArrivals);
            }
          } catch {
            // Ignore arrival fetch errors
          }
        }

        // Total trip time: walk to stop + wait + bus + walk from stop
        const waitMinutes = nextArrivalMinutes !== null ? nextArrivalMinutes : (vehicles.length > 0 ? 5 : 10);
        const totalTripMinutes = originWalkMinutes + waitMinutes + busMinutes + destinationWalkMinutes;

        return {
          route,
          boardingStop: closestOrigin.stop,
          alightingStop: closestDestination.stop,
          originWalkKm: closestOrigin.distanceKm,
          originWalkMinutes,
          destinationWalkKm: closestDestination.distanceKm,
          destinationWalkMinutes,
          vehicles,
          nextArrivalMinutes,
          totalTripMinutes,
        };
      }),
    );

    for (const result of routeChecks) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      }
    }

    // Sort by: has vehicles first, then by total trip time
    return results.sort((a, b) => {
      const aHasVehicles = a.vehicles.length > 0 ? 0 : 1;
      const bHasVehicles = b.vehicles.length > 0 ? 0 : 1;
      if (aHasVehicles !== bHasVehicles) return aHasVehicles - bHasVehicles;

      // Then by total trip time
      return a.totalTripMinutes - b.totalTripMinutes;
    });
  }

  async planRoute(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    departureTime?: string,
    originName: string = 'Origin',
    destinationName: string = 'Destination',
  ): Promise<CyRideRoutePlan> {
    const routes = await this.getRoutes();
    const departure = departureTime ? new Date(departureTime) : new Date();
    const safeDeparture = Number.isNaN(departure.getTime()) ? new Date() : departure;

    const candidates = routes.slice(0, 12);
    const scoredRoutes = await Promise.allSettled(
      candidates.map(async (route) => {
        const routeStops = await this.getStops(route.id);
        if (routeStops.length < 2) {
          return null;
        }

        const closestOrigin = this.findClosestStop(routeStops, origin);
        const closestDestination = this.findClosestStop(routeStops, destination);
        if (!closestOrigin || !closestDestination) {
          return null;
        }

        const busDistanceKm = this.haversineDistanceKm(
          { lat: closestOrigin.stop.latitude, lng: closestOrigin.stop.longitude },
          { lat: closestDestination.stop.latitude, lng: closestDestination.stop.longitude },
        );

        return {
          route,
          originStop: closestOrigin.stop,
          destinationStop: closestDestination.stop,
          originWalkKm: closestOrigin.distanceKm,
          destinationWalkKm: closestDestination.distanceKm,
          busDistanceKm,
          score: closestOrigin.distanceKm + closestDestination.distanceKm + busDistanceKm * 0.2,
        };
      }),
    );

    const bestRoute = scoredRoutes
      .filter(
        (result): result is PromiseFulfilledResult<RoutePlanCandidate | null> =>
          result.status === 'fulfilled',
      )
      .map((result) => result.value)
      .filter((candidate): candidate is RoutePlanCandidate => candidate !== null)
      .sort((a, b) => a.score - b.score)[0];

    if (!bestRoute) {
      const fallbackRoute = routes[0];
      const fallbackDeparture = new Date(safeDeparture.getTime() + 5 * 60 * 1000);
      const fallbackArrival = new Date(safeDeparture.getTime() + 20 * 60 * 1000);

      return {
        origin: {
          name: originName,
          latitude: origin.lat,
          longitude: origin.lng,
        },
        destination: {
          name: destinationName,
          latitude: destination.lat,
          longitude: destination.lng,
        },
        departureTime: safeDeparture.toISOString(),
        arrivalTime: fallbackArrival.toISOString(),
        duration: 20,
        walkingTime: 5,
        routes: [
          {
            routeId: fallbackRoute?.id || '4529',
            routeName: fallbackRoute?.name || '1 Red',
            boardingStop: 'Memorial Union',
            alightingStop: 'State Gym',
            departureTime: fallbackDeparture.toISOString(),
            arrivalTime: fallbackArrival.toISOString(),
          },
        ],
      };
    }

    const routeVehicles = await this.getVehicles(bestRoute.route.id);
    const waitMinutes = routeVehicles.length ? 4 : 9;
    const originWalkMinutes = this.estimateWalkingMinutes(bestRoute.originWalkKm);
    const destinationWalkMinutes = this.estimateWalkingMinutes(bestRoute.destinationWalkKm);
    const busMinutes = this.estimateBusMinutes(bestRoute.busDistanceKm);
    const totalDuration = originWalkMinutes + waitMinutes + busMinutes + destinationWalkMinutes;

    const busDeparture = new Date(
      safeDeparture.getTime() + (originWalkMinutes + waitMinutes) * 60 * 1000,
    );
    const busArrival = new Date(busDeparture.getTime() + busMinutes * 60 * 1000);
    const finalArrival = new Date(busArrival.getTime() + destinationWalkMinutes * 60 * 1000);

    return {
      origin: {
        name: originName,
        latitude: origin.lat,
        longitude: origin.lng,
      },
      destination: {
        name: destinationName,
        latitude: destination.lat,
        longitude: destination.lng,
      },
      departureTime: safeDeparture.toISOString(),
      arrivalTime: finalArrival.toISOString(),
      duration: totalDuration,
      walkingTime: originWalkMinutes + destinationWalkMinutes,
      routes: [
        {
          routeId: bestRoute.route.id,
          routeName: bestRoute.route.name,
          boardingStop: bestRoute.originStop.name,
          alightingStop: bestRoute.destinationStop.name,
          departureTime: busDeparture.toISOString(),
          arrivalTime: busArrival.toISOString(),
        },
      ],
    };
  }
}

export const cyrideService = new CyRideService();
