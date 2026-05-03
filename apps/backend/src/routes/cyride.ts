import express from 'express';
import { authenticateToken } from '../middleware/auth';
import { cyrideService } from '../services/cyride';

const router = express.Router();

// Get all routes
router.get('/routes', async (req, res) => {
  try {
    const routes = await cyrideService.getRoutes();
    res.json({
      success: true,
      data: routes,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'CYRIDE_ROUTES_ERROR',
        message: 'Failed to fetch CyRide routes'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Get favorite routes for user
router.get('/routes/favorites', authenticateToken, async (req, res) => {
  try {
    const routes = await cyrideService.getFavoriteRoutes(req.user!);
    res.json({
      success: true,
      data: routes,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'CYRIDE_FAVORITE_ROUTES_ERROR',
        message: 'Failed to fetch favorite routes'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Get waypoint geometry for a route (polyline points)
router.get('/routes/:routeId/waypoints', async (req, res) => {
  try {
    const { routeId } = req.params;
    const waypoints = await cyrideService.getRouteWaypoints(routeId);
    res.json({
      success: true,
      data: waypoints,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'CYRIDE_WAYPOINTS_ERROR',
        message: 'Failed to fetch route waypoints'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Geocode address query into coordinates (no auth required)
router.get('/geocode', async (req, res) => {
  try {
    const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';
    if (!query) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_GEOCODE_QUERY',
          message: 'A query string is required',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const location = await cyrideService.geocodeAddress(query);
    if (!location) {
      res.status(404).json({
        success: false,
        error: {
          code: 'GEOCODE_NOT_FOUND',
          message: 'Address not found',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.json({
      success: true,
      data: location,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'CYRIDE_GEOCODE_ERROR',
        message: 'Failed to geocode address',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// Suggest addresses for type-ahead search (no auth required)
router.get('/geocode/suggest', async (req, res) => {
  try {
    const query = typeof req.query.query === 'string' ? req.query.query.trim() : '';
    const requestedLimit =
      typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : NaN;
    const limit = Number.isFinite(requestedLimit) ? requestedLimit : 5;

    if (!query || query.length < 2) {
      res.json({
        success: true,
        data: [],
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const suggestions = await cyrideService.suggestAddresses(query, limit);
    res.json({
      success: true,
      data: suggestions,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'CYRIDE_GEOCODE_SUGGEST_ERROR',
        message: 'Failed to fetch address suggestions',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// Get today's active routes with live vehicles
router.get('/routes/active', async (req, res) => {
  try {
    const activeRoutes = await cyrideService.getTodayActiveRoutes();
    res.json({
      success: true,
      data: activeRoutes,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'CYRIDE_ACTIVE_ROUTES_ERROR',
        message: 'Failed to fetch active routes',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// Find routes from origin to destination (with user location)
router.get('/routes/from-to', async (req, res) => {
  try {
    const originLat = parseFloat(req.query.originLat as string);
    const originLng = parseFloat(req.query.originLng as string);
    const destLat = parseFloat(req.query.destLat as string);
    const destLng = parseFloat(req.query.destLng as string);
    const maxWalkKm = parseFloat(req.query.maxWalkKm as string) || 0.8;

    if (
      !Number.isFinite(originLat) ||
      !Number.isFinite(originLng) ||
      !Number.isFinite(destLat) ||
      !Number.isFinite(destLng)
    ) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_COORDINATES',
          message: 'Valid originLat, originLng, destLat, and destLng query parameters are required',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const routes = await cyrideService.findRoutesFromOriginToDestination(
      { lat: originLat, lng: originLng },
      { lat: destLat, lng: destLng },
      maxWalkKm,
    );

    res.json({
      success: true,
      data: routes,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'CYRIDE_ROUTES_FROM_TO_ERROR',
        message: 'Failed to find routes from origin to destination',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// Find routes that serve a destination
router.get('/routes/to-destination', async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const maxWalkKm = parseFloat(req.query.maxWalkKm as string) || 0.8;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_COORDINATES',
          message: 'Valid lat and lng query parameters are required',
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const routes = await cyrideService.findRoutesToDestination(
      { lat, lng },
      maxWalkKm,
    );

    res.json({
      success: true,
      data: routes,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'CYRIDE_ROUTES_TO_DESTINATION_ERROR',
        message: 'Failed to find routes to destination',
      },
      timestamp: new Date().toISOString(),
    });
  }
});

// Get stops for a route
router.get('/stops', async (req, res) => {
  try {
    const routeId = req.query.routeId as string;
    const stops = await cyrideService.getStops(routeId);
    res.json({
      success: true,
      data: stops,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'CYRIDE_STOPS_ERROR',
        message: 'Failed to fetch CyRide stops'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Get nearby stops for user
router.get('/stops/nearby', authenticateToken, async (req, res) => {
  try {
    const radius = parseFloat(req.query.radius as string) || 0.5;
    const stops = await cyrideService.getNearbyStops(req.user!, radius);
    res.json({
      success: true,
      data: stops,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'CYRIDE_NEARBY_STOPS_ERROR',
        message: 'Failed to fetch nearby stops'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Get upcoming trips for user
router.get('/trips/upcoming', authenticateToken, async (req, res) => {
  try {
    const trips = await cyrideService.getUpcomingTrips(req.user!);
    res.json({
      success: true,
      data: trips,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'CYRIDE_UPCOMING_TRIPS_ERROR',
        message: 'Failed to fetch upcoming trips'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Get vehicles for a route
router.get('/vehicles', async (req, res) => {
  try {
    const routeId = req.query.routeId as string;
    const vehicles = await cyrideService.getVehicles(routeId);
    res.json({
      success: true,
      data: vehicles,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'CYRIDE_VEHICLES_ERROR',
        message: 'Failed to fetch vehicles'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Plan a route
router.post('/route-plan', authenticateToken, async (req, res) => {
  try {
    const { origin, destination, departureTime, originName, destinationName } = req.body;

    const hasValidOrigin =
      origin && typeof origin.lat === 'number' && typeof origin.lng === 'number';
    const hasValidDestination =
      destination && typeof destination.lat === 'number' && typeof destination.lng === 'number';

    if (!hasValidOrigin || !hasValidDestination) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ROUTE_PARAMS',
          message: 'Origin and destination with lat/lng coordinates are required'
        },
        timestamp: new Date().toISOString()
      });
      return;
    }

    const routePlan = await cyrideService.planRoute(
      origin,
      destination,
      departureTime,
      typeof originName === 'string' ? originName : 'Origin',
      typeof destinationName === 'string' ? destinationName : 'Destination',
    );
    res.json({
      success: true,
      data: routePlan,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'CYRIDE_ROUTE_PLAN_ERROR',
        message: 'Failed to plan route'
      },
      timestamp: new Date().toISOString()
    });
  }
});

export { router as cyrideRouter };
