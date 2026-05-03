import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  TextInput,
  Keyboard,
  ScrollView,
  Alert,
  Dimensions,
  PanResponder,
  Animated as RNAnimated,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import LottieView from 'lottie-react-native';

import { apiService } from '../services/api';
import { CyRideRoute, CyRideStop, CyRideVehicle } from '@cypilot/shared';
import { palette, radii, shadows, spacing } from '../theme/tokens';

interface CoordinatePoint {
  latitude: number;
  longitude: number;
}

interface GeocodeLocation extends CoordinatePoint {
  name: string;
}

interface RouteToDestination {
  route: CyRideRoute;
  nearestStop: CyRideStop;
  walkingDistanceKm: number;
  walkingMinutes: number;
  vehicles: CyRideVehicle[];
  nextArrivalMinutes: number | null;
}

interface RouteFromOriginToDestination {
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
}

interface ActiveRoute {
  route: CyRideRoute;
  vehicleCount: number;
  vehicles: CyRideVehicle[];
}

interface UserLocation {
  latitude: number;
  longitude: number;
}

const DEFAULT_REGION = {
  latitude: 42.0267,
  longitude: -93.6465,
  latitudeDelta: 0.025,
  longitudeDelta: 0.025,
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MODAL_MAX_HEIGHT = SCREEN_HEIGHT * 0.55;
const MODAL_MIN_HEIGHT = 120;
const MODAL_SNAP_TOP = 0;
const MODAL_SNAP_BOTTOM = MODAL_MAX_HEIGHT - MODAL_MIN_HEIGHT;

// Popular ISU campus destinations for quick access
const POPULAR_DESTINATIONS = [
  { name: 'Parks Library', latitude: 42.0288, longitude: -93.6457, icon: 'library' as const },
  { name: 'Memorial Union', latitude: 42.0267, longitude: -93.6479, icon: 'restaurant' as const },
  { name: 'State Gym', latitude: 42.0253, longitude: -93.6527, icon: 'fitness' as const },
  { name: 'Hilton Coliseum', latitude: 42.0215, longitude: -93.6360, icon: 'american-football' as const },
  { name: 'Beardshear Hall', latitude: 42.0262, longitude: -93.6488, icon: 'business' as const },
  { name: 'Coover Hall', latitude: 42.0275, longitude: -93.6505, icon: 'hardware-chip' as const },
];

const getOccupancyColor = (occupancy?: string): string => {
  switch (occupancy) {
    case 'high':
      return palette.danger;
    case 'medium':
      return palette.warning;
    case 'low':
      return palette.success;
    default:
      return palette.textMuted;
  }
};

const getOccupancyLabel = (occupancy?: string): string => {
  switch (occupancy) {
    case 'high':
      return 'Crowded';
    case 'medium':
      return 'Some seats';
    case 'low':
      return 'Empty';
    default:
      return '';
  }
};

type ScreenState = 'search' | 'results' | 'tracking';

export const CyRideScreen: React.FC = () => {
  const navigation = useNavigation();
  const mapRef = useRef<MapView | null>(null);

  // Screen state
  const [screenState, setScreenState] = useState<ScreenState>('search');

  // Hide tab bar when in tracking mode for full-screen map
  useEffect(() => {
    if (screenState === 'tracking') {
      navigation.setOptions({
        tabBarStyle: { display: 'none' },
      });
    } else {
      // Restore the default tab bar style from MainTabNavigator
      navigation.setOptions({
        tabBarStyle: {
          position: 'absolute',
          left: 14,
          right: 14,
          bottom: 14,
          height: 72,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: '#E5E7EB',
          borderRadius: 20,
          backgroundColor: 'rgba(255,255,255,0.98)',
          paddingTop: 10,
          paddingBottom: 8,
          overflow: 'visible',
        },
      });
    }
  }, [screenState, navigation]);

  // Search state
  const [searchInput, setSearchInput] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodeLocation[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);

  // User location
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  // Selected destination
  const [destination, setDestination] = useState<GeocodeLocation | null>(null);

  // Selected route for tracking
  const [selectedRoute, setSelectedRoute] = useState<RouteFromOriginToDestination | null>(null);

  // Selected active route for schedule modal
  const [scheduleRoute, setScheduleRoute] = useState<ActiveRoute | null>(null);

  // Bottom sheet animation using React Native Animated
  const translateY = useRef(new RNAnimated.Value(0)).current;
  const lastGestureDy = useRef(0);
  const [isModalExpanded, setIsModalExpanded] = useState(true);

  const springTo = useCallback((toValue: number) => {
    RNAnimated.spring(translateY, {
      toValue,
      useNativeDriver: true,
      damping: 20,
      stiffness: 90,
    }).start();
  }, [translateY]);

  const toggleModal = useCallback(() => {
    if (isModalExpanded) {
      springTo(MODAL_SNAP_BOTTOM);
      setIsModalExpanded(false);
    } else {
      springTo(MODAL_SNAP_TOP);
      setIsModalExpanded(true);
    }
  }, [isModalExpanded, springTo]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        translateY.extractOffset();
      },
      onPanResponderMove: (_, gestureState) => {
        const newY = Math.max(MODAL_SNAP_TOP, Math.min(MODAL_SNAP_BOTTOM, gestureState.dy));
        translateY.setValue(newY);
        lastGestureDy.current = gestureState.dy;
      },
      onPanResponderRelease: (_, gestureState) => {
        translateY.flattenOffset();

        if (gestureState.vy > 0.5) {
          // Fast swipe down
          springTo(MODAL_SNAP_BOTTOM);
          setIsModalExpanded(false);
        } else if (gestureState.vy < -0.5) {
          // Fast swipe up
          springTo(MODAL_SNAP_TOP);
          setIsModalExpanded(true);
        } else {
          // Based on position
          const currentValue = lastGestureDy.current;
          const shouldExpand = currentValue < MODAL_SNAP_BOTTOM / 2;
          springTo(shouldExpand ? MODAL_SNAP_TOP : MODAL_SNAP_BOTTOM);
          setIsModalExpanded(shouldExpand);
        }
      },
    })
  ).current;

  // Reset modal when route changes
  useEffect(() => {
    if (selectedRoute) {
      translateY.setValue(0);
      setIsModalExpanded(true);
    }
  }, [selectedRoute, translateY]);

  // Mock active routes for demo
  const now = new Date().toISOString();
  const mockActiveRoutes: ActiveRoute[] = [
    {
      route: { id: '1', name: 'Red Route', color: '#DC2626', description: 'Campus circular via MU', type: 'bus', status: 'active', operatingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] },
      vehicleCount: 3,
      vehicles: [
        { id: '101', routeId: '1', latitude: 42.0267, longitude: -93.6479, heading: 45, speed: 15, occupancy: 'low' as const, lastUpdate: now },
        { id: '102', routeId: '1', latitude: 42.0288, longitude: -93.6457, heading: 90, speed: 12, occupancy: 'medium' as const, lastUpdate: now },
        { id: '103', routeId: '1', latitude: 42.0253, longitude: -93.6527, heading: 180, speed: 0, occupancy: 'low' as const, lastUpdate: now },
      ]
    },
    {
      route: { id: '2', name: 'Blue Route', color: '#2563EB', description: 'West Ames Express', type: 'bus', status: 'active', operatingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] },
      vehicleCount: 2,
      vehicles: [
        { id: '201', routeId: '2', latitude: 42.0220, longitude: -93.6580, heading: 270, speed: 25, occupancy: 'high' as const, lastUpdate: now },
        { id: '202', routeId: '2', latitude: 42.0300, longitude: -93.6400, heading: 0, speed: 18, occupancy: 'medium' as const, lastUpdate: now },
      ]
    },
    {
      route: { id: '3', name: 'Green Route', color: '#059669', description: 'South Campus', type: 'bus', status: 'active', operatingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] },
      vehicleCount: 2,
      vehicles: [
        { id: '301', routeId: '3', latitude: 42.0200, longitude: -93.6500, heading: 135, speed: 20, occupancy: 'low' as const, lastUpdate: now },
        { id: '302', routeId: '3', latitude: 42.0240, longitude: -93.6450, heading: 315, speed: 10, occupancy: 'low' as const, lastUpdate: now },
      ]
    },
    {
      route: { id: '4', name: 'Orange Route', color: '#EA580C', description: 'North Grand Mall', type: 'bus', status: 'active', operatingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] },
      vehicleCount: 1,
      vehicles: [
        { id: '401', routeId: '4', latitude: 42.0350, longitude: -93.6200, heading: 45, speed: 30, occupancy: 'medium' as const, lastUpdate: now },
      ]
    },
    {
      route: { id: '5', name: 'Purple Route', color: '#7C3AED', description: 'Research Park Express', type: 'bus', status: 'active', operatingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] },
      vehicleCount: 1,
      vehicles: [
        { id: '501', routeId: '5', latitude: 42.0150, longitude: -93.6600, heading: 225, speed: 22, occupancy: 'low' as const, lastUpdate: now },
      ]
    },
  ];

  // Today's active routes query
  const activeRoutesQuery = useQuery<ActiveRoute[]>({
    queryKey: ['cyride', 'active-routes'],
    queryFn: () => apiService.get<ActiveRoute[]>('/api/cyride/routes/active'),
    refetchInterval: 60000, // Refresh every minute
    placeholderData: mockActiveRoutes,
  });

  // Fetch stops for selected schedule route
  const scheduleStopsQuery = useQuery<CyRideStop[]>({
    queryKey: ['cyride', 'stops', scheduleRoute?.route.id],
    queryFn: () =>
      apiService.get<CyRideStop[]>('/api/cyride/stops', {
        params: { routeId: scheduleRoute!.route.id },
      }),
    enabled: Boolean(scheduleRoute),
  });

  // Find routes from user location to destination
  const routesToDestinationQuery = useQuery<RouteFromOriginToDestination[]>({
    queryKey: [
      'cyride',
      'routes-from-to',
      userLocation?.latitude,
      userLocation?.longitude,
      destination?.latitude,
      destination?.longitude,
    ],
    queryFn: () =>
      apiService.get<RouteFromOriginToDestination[]>('/api/cyride/routes/from-to', {
        params: {
          originLat: userLocation!.latitude,
          originLng: userLocation!.longitude,
          destLat: destination!.latitude,
          destLng: destination!.longitude,
        },
      }),
    enabled: Boolean(destination) && Boolean(userLocation),
    refetchInterval: 30000, // Refresh every 30s for live ETAs
  });

  // Live vehicles for selected route
  const vehiclesQuery = useQuery<CyRideVehicle[]>({
    queryKey: ['cyride', 'vehicles', selectedRoute?.route.id],
    queryFn: () =>
      apiService.get<CyRideVehicle[]>('/api/cyride/vehicles', {
        params: { routeId: selectedRoute!.route.id },
      }),
    enabled: Boolean(selectedRoute),
    refetchInterval: 10000, // Fast refresh for live tracking
  });

  // Route waypoints for polyline
  const waypointsQuery = useQuery<CoordinatePoint[]>({
    queryKey: ['cyride', 'waypoints', selectedRoute?.route.id],
    queryFn: () =>
      apiService.get<CoordinatePoint[]>(`/api/cyride/routes/${selectedRoute!.route.id}/waypoints`),
    enabled: Boolean(selectedRoute),
  });

  // Debounced search suggestions
  useEffect(() => {
    const query = searchInput.trim();
    if (query.length < 2) {
      setSuggestions([]);
      setIsSuggesting(false);
      return;
    }

    let cancelled = false;
    const debounce = setTimeout(() => {
      setIsSuggesting(true);

      void apiService
        .get<GeocodeLocation[]>('/api/cyride/geocode/suggest', {
          params: { query, limit: 5 },
        })
        .then((results) => {
          if (!cancelled) {
            setSuggestions(results);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setSuggestions([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsSuggesting(false);
          }
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(debounce);
    };
  }, [searchInput]);

  // Fit map to show route and vehicles
  useEffect(() => {
    if (!mapRef.current || screenState !== 'tracking' || !selectedRoute) return;

    const coords: CoordinatePoint[] = [];

    // Add user location
    if (userLocation) {
      coords.push({ latitude: userLocation.latitude, longitude: userLocation.longitude });
    }

    // Add destination
    if (destination) {
      coords.push({ latitude: destination.latitude, longitude: destination.longitude });
    }

    // Add boarding stop
    coords.push({
      latitude: selectedRoute.boardingStop.latitude,
      longitude: selectedRoute.boardingStop.longitude,
    });

    // Add alighting stop
    coords.push({
      latitude: selectedRoute.alightingStop.latitude,
      longitude: selectedRoute.alightingStop.longitude,
    });

    // Add vehicles
    const vehicles = vehiclesQuery.data ?? [];
    vehicles.forEach((v) => {
      coords.push({ latitude: v.latitude, longitude: v.longitude });
    });

    // Add waypoints
    const waypoints = waypointsQuery.data ?? [];
    if (waypoints.length > 0) {
      coords.push(...waypoints.slice(0, 10)); // Sample some waypoints
    }

    if (coords.length > 1) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 100, right: 50, bottom: 200, left: 50 },
        animated: true,
      });
    } else if (coords.length === 1) {
      mapRef.current.animateToRegion({
        latitude: coords[0].latitude,
        longitude: coords[0].longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }, 500);
    }
  }, [screenState, selectedRoute, vehiclesQuery.data, waypointsQuery.data, destination, userLocation]);

  // Get user location
  const getUserLocation = async (): Promise<UserLocation | null> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission',
          'We need your location to find buses from where you are. Please enable location access in settings.',
          [{ text: 'OK' }],
        );
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert(
        'Location Error',
        'Could not get your current location. Please try again.',
        [{ text: 'OK' }],
      );
      return null;
    }
  };

  const handleSelectDestination = async (location: GeocodeLocation) => {
    Keyboard.dismiss();
    setDestination(location);
    setSearchInput(location.name);
    setSuggestions([]);
    setIsLoadingLocation(true);
    setScreenState('results');

    // Get user's current location
    const currentLocation = await getUserLocation();
    if (currentLocation) {
      setUserLocation(currentLocation);
    }
    setIsLoadingLocation(false);
  };

  const handleSelectPopularDestination = async (dest: typeof POPULAR_DESTINATIONS[0]) => {
    await handleSelectDestination({
      name: dest.name,
      latitude: dest.latitude,
      longitude: dest.longitude,
    });
  };

  const handleSelectRoute = (route: RouteFromOriginToDestination) => {
    setSelectedRoute(route);
    setScreenState('tracking');
  };

  const handleBack = () => {
    if (screenState === 'tracking') {
      setSelectedRoute(null);
      setScreenState('results');
    } else if (screenState === 'results') {
      setDestination(null);
      setSearchInput('');
      setScreenState('search');
    }
  };

  const handleNewSearch = () => {
    setDestination(null);
    setSelectedRoute(null);
    setSearchInput('');
    setScreenState('search');
  };

  const routes = routesToDestinationQuery.data ?? [];
  const vehicles = vehiclesQuery.data ?? [];
  const waypoints = waypointsQuery.data ?? [];

  // Render search screen
  const renderSearchScreen = () => (
    <ScrollView style={styles.searchContainer} contentContainerStyle={styles.searchContent} keyboardShouldPersistTaps="handled">
      <View style={styles.searchHeader}>
        <Ionicons name="bus" size={32} color={palette.cyride} />
        <Text style={styles.searchTitle}>Where do you want to go?</Text>
        <Text style={styles.searchSubtitle}>
          Search for a destination to find available buses
        </Text>
      </View>

      <View style={styles.searchInputContainer}>
        <Ionicons name="search" size={20} color={palette.textMuted} style={styles.searchIcon} />
        <TextInput
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Search destination..."
          placeholderTextColor={palette.textMuted}
          style={styles.searchInput}
          autoCapitalize="words"
          autoCorrect={false}
          autoFocus
        />
        {searchInput.length > 0 && (
          <Pressable onPress={() => setSearchInput('')} style={styles.clearButton}>
            <Ionicons name="close-circle" size={20} color={palette.textMuted} />
          </Pressable>
        )}
      </View>

      {isSuggesting && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={palette.brand} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      )}

      {suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          {suggestions.map((location, index) => (
            <Pressable
              key={`${location.latitude}-${location.longitude}-${index}`}
              onPress={() => handleSelectDestination(location)}
              style={styles.suggestionItem}
            >
              <Ionicons name="location" size={18} color={palette.brand} />
              <Text numberOfLines={2} style={styles.suggestionText}>
                {location.name}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={palette.textMuted} />
            </Pressable>
          ))}
        </View>
      )}

      {searchInput.length === 0 && (
        <>
          <View style={styles.popularSection}>
            <Text style={styles.popularTitle}>Popular on Campus</Text>
            <View style={styles.popularGrid}>
              {POPULAR_DESTINATIONS.map((dest) => (
                <Pressable
                  key={dest.name}
                  onPress={() => handleSelectPopularDestination(dest)}
                  style={styles.popularChip}
                >
                  <Ionicons name={dest.icon || 'location'} size={14} color={palette.cyride} />
                  <Text style={styles.popularChipText}>{dest.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Today's Active Routes */}
          <View style={styles.activeRoutesSection}>
            <View style={styles.activeRoutesHeader}>
              <Ionicons name="radio" size={16} color={palette.success} />
              <Text style={styles.activeRoutesTitle}>Active Now</Text>
              {activeRoutesQuery.isFetching && (
                <ActivityIndicator size="small" color={palette.brand} />
              )}
            </View>
            {activeRoutesQuery.isLoading ? (
              <View style={styles.activeRoutesLoading}>
                <ActivityIndicator size="small" color={palette.brand} />
                <Text style={styles.loadingText}>Loading active routes...</Text>
              </View>
            ) : (activeRoutesQuery.data ?? []).length === 0 ? (
              <View style={styles.noActiveRoutes}>
                <Ionicons name="moon-outline" size={24} color={palette.textMuted} />
                <Text style={styles.noActiveRoutesText}>No buses running right now</Text>
              </View>
            ) : (
              <View style={styles.activeRoutesList}>
                {(activeRoutesQuery.data ?? []).map((activeRoute) => (
                  <Pressable
                    key={activeRoute.route.id}
                    onPress={() => setScheduleRoute(activeRoute)}
                    style={[
                      styles.activeRouteRow,
                      { borderLeftColor: activeRoute.route.color },
                    ]}
                  >
                    <View
                      style={[
                        styles.activeRouteBadge,
                        { backgroundColor: activeRoute.route.color },
                      ]}
                    >
                      <Ionicons name="bus" size={14} color="#FFF" />
                    </View>
                    <Text style={styles.activeRouteRowName} numberOfLines={1}>
                      {activeRoute.route.name}
                    </Text>
                    <View style={styles.activeRouteRowInfo}>
                      <View style={styles.activeRouteVehicles}>
                        <Ionicons name="car" size={12} color={palette.success} />
                        <Text style={styles.activeRouteVehicleCount}>
                          {activeRoute.vehicleCount}
                        </Text>
                      </View>
                      {activeRoute.vehicles[0]?.occupancy && (
                        <View style={styles.activeRouteOccupancy}>
                          <Ionicons
                            name="people"
                            size={12}
                            color={getOccupancyColor(activeRoute.vehicles[0].occupancy)}
                          />
                          <Text
                            style={[
                              styles.activeRouteOccupancyText,
                              { color: getOccupancyColor(activeRoute.vehicles[0].occupancy) },
                            ]}
                          >
                            {getOccupancyLabel(activeRoute.vehicles[0].occupancy)}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={palette.textMuted} />
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );

  // Render results screen (bus list)
  const renderResultsScreen = () => (
    <View style={styles.resultsContainer}>
      <View style={styles.resultsHeader}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={palette.textPrimary} />
        </Pressable>
        <View style={styles.resultsHeaderText}>
          <Text style={styles.resultsTitle}>Buses to</Text>
          <Text style={styles.destinationName} numberOfLines={1}>
            {destination?.name}
          </Text>
        </View>
        <Pressable onPress={handleNewSearch} style={styles.newSearchButton}>
          <Ionicons name="search" size={20} color={palette.brand} />
        </Pressable>
      </View>

      {isLoadingLocation || routesToDestinationQuery.isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={palette.brand} />
          <Text style={styles.loadingText}>
            {isLoadingLocation ? 'Getting your location...' : 'Finding buses...'}
          </Text>
          {userLocation && (
            <Text style={styles.locationFoundText}>
              <Ionicons name="location" size={12} color={palette.success} /> Location found
            </Text>
          )}
        </View>
      ) : !userLocation ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="location-outline" size={48} color={palette.textMuted} />
          <Text style={styles.emptyTitle}>Location needed</Text>
          <Text style={styles.emptySubtitle}>
            We need your location to find buses from where you are.
          </Text>
          <Pressable
            onPress={async () => {
              setIsLoadingLocation(true);
              const loc = await getUserLocation();
              if (loc) setUserLocation(loc);
              setIsLoadingLocation(false);
            }}
            style={styles.tryAgainButton}
          >
            <Text style={styles.tryAgainText}>Enable Location</Text>
          </Pressable>
        </View>
      ) : routes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="bus-outline" size={48} color={palette.textMuted} />
          <Text style={styles.emptyTitle}>No buses found</Text>
          <Text style={styles.emptySubtitle}>
            No active buses are currently serving this destination.
            Try a different location or check back later.
          </Text>
          <Pressable onPress={handleNewSearch} style={styles.tryAgainButton}>
            <Text style={styles.tryAgainText}>Search Again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView style={styles.routesListScroll} contentContainerStyle={styles.routesList}>
          {routes.map((routeData, index) => {
            const hasVehicles = routeData.vehicles.length > 0;
            const etaText = routeData.nextArrivalMinutes !== null
              ? `${routeData.nextArrivalMinutes} min`
              : hasVehicles
              ? 'Active'
              : 'No buses';

            return (
              <Pressable
                key={routeData.route.id}
                onPress={() => handleSelectRoute(routeData)}
                style={[
                  styles.routeCard,
                  index === 0 && styles.routeCardFirst,
                ]}
              >
                <View style={styles.routeCardLeft}>
                  <View
                    style={[
                      styles.routeColorBadge,
                      { backgroundColor: routeData.route.color },
                    ]}
                  >
                    <Ionicons name="bus" size={20} color="#FFF" />
                  </View>
                </View>

                <View style={styles.routeCardContent}>
                  <Text style={styles.routeName}>{routeData.route.name}</Text>
                  <View style={styles.routeStops}>
                    <Text style={styles.stopNameSmall} numberOfLines={1}>
                      <Ionicons name="ellipse" size={8} color={palette.success} /> {routeData.boardingStop.name}
                    </Text>
                    <Ionicons name="arrow-forward" size={12} color={palette.textMuted} />
                    <Text style={styles.stopNameSmall} numberOfLines={1}>
                      <Ionicons name="flag" size={8} color={palette.brand} /> {routeData.alightingStop.name}
                    </Text>
                  </View>
                  <View style={styles.routeMeta}>
                    <View style={styles.metaItem}>
                      <Ionicons name="time" size={14} color={palette.brand} />
                      <Text style={styles.metaText}>
                        ~{routeData.totalTripMinutes} min total
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Ionicons name="walk" size={14} color={palette.textMuted} />
                      <Text style={styles.metaText}>
                        {routeData.originWalkMinutes}+{routeData.destinationWalkMinutes} min walk
                      </Text>
                    </View>
                    {hasVehicles && routeData.vehicles[0]?.occupancy && (
                      <View style={styles.metaItem}>
                        <Ionicons
                          name="people"
                          size={14}
                          color={getOccupancyColor(routeData.vehicles[0].occupancy)}
                        />
                        <Text
                          style={[
                            styles.metaText,
                            { color: getOccupancyColor(routeData.vehicles[0].occupancy) },
                          ]}
                        >
                          {getOccupancyLabel(routeData.vehicles[0].occupancy)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.routeCardRight}>
                  <Text
                    style={[
                      styles.etaText,
                      hasVehicles ? styles.etaActive : styles.etaInactive,
                    ]}
                  >
                    {etaText}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color={palette.textMuted} />
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );

  // Render tracking screen (map with live bus)
  const renderTrackingScreen = () => (
    <View style={styles.trackingContainer}>
      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={DEFAULT_REGION}
        provider={PROVIDER_DEFAULT}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {/* Route polyline */}
        {waypoints.length > 1 && (
          <>
            <Polyline
              coordinates={waypoints}
              strokeColor={selectedRoute?.route.color || palette.cyride}
              strokeWidth={3}
            />
            {/* Route Start Marker - animated */}
            <Marker
              coordinate={waypoints[0]}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.routeEndpointContainer}>
                <LottieView
                  source={require('../../assets/animations/route-start.json')}
                  autoPlay
                  loop
                  speed={0.5}
                  style={styles.routeEndpointLottie}
                />
              </View>
            </Marker>
            {/* Route End Marker - animated */}
            <Marker
              coordinate={waypoints[waypoints.length - 1]}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.routeEndpointContainer}>
                <LottieView
                  source={require('../../assets/animations/route-end.json')}
                  autoPlay
                  loop
                  speed={0.5}
                  style={styles.routeEndpointLottie}
                />
              </View>
            </Marker>
          </>
        )}

        {/* Live bus markers - animated with Lottie */}
        {vehicles.map((vehicle) => (
          <Marker
            key={vehicle.id}
            coordinate={{ latitude: vehicle.latitude, longitude: vehicle.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            flat={true}
          >
            <View style={styles.animatedBusContainer}>
              {/* Pulsing rings - don't rotate */}
              <LottieView
                source={require('../../assets/animations/bus-marker.json')}
                autoPlay
                loop
                speed={0.8}
                style={styles.busLottie}
              />
              {/* Bus overlay - rotates with heading */}
              <View
                style={[
                  styles.busColorOverlay,
                  {
                    backgroundColor: selectedRoute?.route.color || palette.cyride,
                    transform: [{ rotate: `${vehicle.heading || 0}deg` }],
                  },
                ]}
              >
                <View style={styles.busWindshield} />
                <View style={styles.busDirectionArrow} />
              </View>
            </View>
          </Marker>
        ))}

        {/* Destination marker */}
        {destination && (
          <Marker
            coordinate={{ latitude: destination.latitude, longitude: destination.longitude }}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={styles.destinationMarkerContainer}>
              <View style={styles.destinationMarkerPin}>
                <Ionicons name="location" size={24} color="#FFF" />
              </View>
              <View style={styles.destinationMarkerArrow} />
            </View>
          </Marker>
        )}

        {/* Boarding stop marker - animated */}
        {selectedRoute && (
          <Marker
            coordinate={{
              latitude: selectedRoute.boardingStop.latitude,
              longitude: selectedRoute.boardingStop.longitude,
            }}
            anchor={{ x: 0.5, y: 0.85 }}
          >
            <View style={styles.animatedStopContainer}>
              <LottieView
                source={require('../../assets/animations/stop-marker.json')}
                autoPlay
                loop
                speed={0.6}
                style={styles.stopLottie}
                colorFilters={[
                  { keypath: 'Pulse', color: palette.success },
                  { keypath: 'Pin Circle', color: palette.success },
                  { keypath: 'Arrow', color: palette.success },
                ]}
              />
              <View style={styles.stopIconOverlay}>
                <View style={[styles.stopIconCircle, { backgroundColor: palette.success }]}>
                  <Ionicons name="enter" size={18} color="#FFF" />
                </View>
                <View style={[styles.stopLabelBadge, { backgroundColor: palette.success }]}>
                  <Text style={styles.stopLabelBadgeText}>BOARD</Text>
                </View>
              </View>
            </View>
          </Marker>
        )}

        {/* Alighting stop marker - animated */}
        {selectedRoute && (
          <Marker
            coordinate={{
              latitude: selectedRoute.alightingStop.latitude,
              longitude: selectedRoute.alightingStop.longitude,
            }}
            anchor={{ x: 0.5, y: 0.85 }}
          >
            <View style={styles.animatedStopContainer}>
              <LottieView
                source={require('../../assets/animations/stop-marker.json')}
                autoPlay
                loop
                speed={0.6}
                style={styles.stopLottie}
                colorFilters={[
                  { keypath: 'Pulse', color: palette.brand },
                  { keypath: 'Pin Circle', color: palette.brand },
                  { keypath: 'Arrow', color: palette.brand },
                ]}
              />
              <View style={styles.stopIconOverlay}>
                <View style={[styles.stopIconCircle, { backgroundColor: palette.brand }]}>
                  <Ionicons name="exit" size={18} color="#FFF" />
                </View>
                <View style={[styles.stopLabelBadge, { backgroundColor: palette.brand }]}>
                  <Text style={styles.stopLabelBadgeText}>EXIT</Text>
                </View>
              </View>
            </View>
          </Marker>
        )}

        {/* User location marker */}
        {userLocation && (
          <Marker
            coordinate={{
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.userLocationMarker}>
              <View style={styles.userLocationDot} />
            </View>
          </Marker>
        )}
      </MapView>

      {/* Floating back button */}
      <Pressable onPress={handleBack} style={styles.floatingBackButton}>
        <Ionicons name="arrow-back" size={24} color={palette.textPrimary} />
      </Pressable>

      {/* Bottom info card - Draggable */}
      <RNAnimated.View
        style={[
          styles.trackingInfoCard,
          { transform: [{ translateY: translateY }] },
        ]}
      >
          {/* Handle bar - drag to move */}
          <View {...panResponder.panHandlers} style={styles.handleBarContainer}>
            <View style={styles.handleBar} />
          </View>

          {/* Route Header with gradient feel - tap to toggle */}
          <Pressable onPress={toggleModal} {...panResponder.panHandlers}>
            <View style={[styles.trackingHeaderNew, { backgroundColor: selectedRoute?.route.color }]}>
              <View style={styles.trackingHeaderLeft}>
                <MaterialCommunityIcons name="bus" size={28} color="#FFF" />
                <View style={styles.trackingHeaderInfo}>
                  <Text style={styles.trackingRouteNameNew}>{selectedRoute?.route.name}</Text>
                  <View style={styles.liveIndicator}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>
                      {vehicles.length} bus{vehicles.length !== 1 ? 'es' : ''} live
                    </Text>
                    {vehiclesQuery.isFetching && (
                      <ActivityIndicator size="small" color="#FFF" style={{ marginLeft: 8 }} />
                    )}
                  </View>
                </View>
              </View>
              <View style={styles.etaBadge}>
                <Text style={styles.etaBadgeText}>
                  {selectedRoute?.nextArrivalMinutes !== null
                    ? `${selectedRoute?.nextArrivalMinutes} min`
                    : '~' + selectedRoute?.totalTripMinutes + ' min'}
                </Text>
                <Text style={styles.etaBadgeLabel}>ETA</Text>
              </View>
            </View>
          </Pressable>

          {/* Scrollable Journey Details */}
          <ScrollView
            style={styles.modalScrollView}
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Journey Timeline */}
            <View style={styles.journeyTimeline}>
              {/* Start Point */}
              <View style={styles.timelineItem}>
                <View style={styles.timelineIconContainer}>
                  <View style={[styles.timelineIcon, styles.timelineIconStart]}>
                    <Ionicons name="walk" size={16} color="#FFF" />
                  </View>
                  <View style={styles.timelineLine} />
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineLabel}>Walk to stop</Text>
                  <Text style={styles.timelineValue}>{selectedRoute?.boardingStop.name}</Text>
                  <Text style={styles.timelineMeta}>{selectedRoute?.originWalkMinutes} min · {((selectedRoute?.originWalkKm ?? 0) * 1000).toFixed(0)}m</Text>
                </View>
              </View>

              {/* Bus Ride */}
              <View style={styles.timelineItem}>
                <View style={styles.timelineIconContainer}>
                  <View style={[styles.timelineIcon, { backgroundColor: selectedRoute?.route.color }]}>
                    <MaterialCommunityIcons name="bus" size={16} color="#FFF" />
                  </View>
                  <View style={styles.timelineLine} />
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineLabel}>Ride the bus</Text>
                  <Text style={styles.timelineValue}>Exit at {selectedRoute?.alightingStop.name}</Text>
                  {vehicles.length > 0 && vehicles[0].occupancy && (
                    <View style={styles.occupancyBadge}>
                      <Ionicons name="people" size={12} color={getOccupancyColor(vehicles[0].occupancy)} />
                      <Text style={[styles.occupancyText, { color: getOccupancyColor(vehicles[0].occupancy) }]}>
                        {getOccupancyLabel(vehicles[0].occupancy)}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* End Point */}
              <View style={styles.timelineItem}>
                <View style={styles.timelineIconContainer}>
                  <View style={[styles.timelineIcon, styles.timelineIconEnd]}>
                    <Ionicons name="flag" size={16} color="#FFF" />
                  </View>
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineLabel}>Walk to destination</Text>
                  <Text style={styles.timelineValue}>{destination?.name}</Text>
                  <Text style={styles.timelineMeta}>{selectedRoute?.destinationWalkMinutes} min · {((selectedRoute?.destinationWalkKm ?? 0) * 1000).toFixed(0)}m</Text>
                </View>
              </View>
            </View>

            {/* Live indicator footer */}
            <View style={styles.liveFooter}>
              <View style={styles.pulsingDot} />
              <Text style={styles.liveFooterText}>Live tracking · Updates every 10s</Text>
            </View>
          </ScrollView>
        </RNAnimated.View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {screenState === 'search' && renderSearchScreen()}
      {screenState === 'results' && renderResultsScreen()}
      {screenState === 'tracking' && renderTrackingScreen()}

      {/* Schedule Modal */}
      <Modal
        visible={Boolean(scheduleRoute)}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setScheduleRoute(null)}
      >
        <View style={styles.scheduleModalOverlay}>
          <View style={styles.scheduleModalContent}>
            {/* Header */}
            <View style={[styles.scheduleModalHeader, { backgroundColor: scheduleRoute?.route.color }]}>
              <View style={styles.scheduleModalHeaderLeft}>
                <MaterialCommunityIcons name="bus" size={28} color="#FFF" />
                <View>
                  <Text style={styles.scheduleModalTitle}>{scheduleRoute?.route.name}</Text>
                  <View style={styles.scheduleModalLive}>
                    <View style={styles.scheduleModalLiveDot} />
                    <Text style={styles.scheduleModalLiveText}>
                      {scheduleRoute?.vehicleCount} bus{scheduleRoute?.vehicleCount !== 1 ? 'es' : ''} active
                    </Text>
                  </View>
                </View>
              </View>
              <Pressable onPress={() => setScheduleRoute(null)} style={styles.scheduleModalClose}>
                <Ionicons name="close" size={24} color="#FFF" />
              </Pressable>
            </View>

            {/* Stops List */}
            <ScrollView style={styles.scheduleModalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.scheduleModalSectionTitle}>Today's Stops</Text>

              {scheduleStopsQuery.isLoading ? (
                <View style={styles.scheduleModalLoading}>
                  <ActivityIndicator size="small" color={palette.brand} />
                  <Text style={styles.loadingText}>Loading stops...</Text>
                </View>
              ) : (scheduleStopsQuery.data ?? []).length === 0 ? (
                <View style={styles.scheduleModalEmpty}>
                  <Ionicons name="alert-circle-outline" size={32} color={palette.textMuted} />
                  <Text style={styles.scheduleModalEmptyText}>No stops available</Text>
                </View>
              ) : (
                <View style={styles.scheduleStopsList}>
                  {(scheduleStopsQuery.data ?? []).map((stop, index) => (
                    <View key={stop.id} style={styles.scheduleStopItem}>
                      <View style={styles.scheduleStopTimeline}>
                        <View style={[
                          styles.scheduleStopDot,
                          { backgroundColor: scheduleRoute?.route.color },
                          index === 0 && styles.scheduleStopDotFirst,
                        ]} />
                        {index < (scheduleStopsQuery.data?.length ?? 0) - 1 && (
                          <View style={[styles.scheduleStopLine, { backgroundColor: scheduleRoute?.route.color }]} />
                        )}
                      </View>
                      <View style={styles.scheduleStopInfo}>
                        <Text style={styles.scheduleStopName}>{stop.name}</Text>
                        {stop.description && (
                          <Text style={styles.scheduleStopDesc}>{stop.description}</Text>
                        )}
                      </View>
                      {stop.accessible && (
                        <Ionicons name="accessibility" size={16} color={palette.textMuted} />
                      )}
                    </View>
                  ))}
                </View>
              )}

              {/* Active Vehicles */}
              {scheduleRoute && scheduleRoute.vehicles.length > 0 && (
                <>
                  <Text style={[styles.scheduleModalSectionTitle, { marginTop: spacing.lg }]}>
                    Live Buses
                  </Text>
                  <View style={styles.scheduleVehiclesList}>
                    {scheduleRoute.vehicles.map((vehicle) => (
                      <View key={vehicle.id} style={styles.scheduleVehicleItem}>
                        <View style={[styles.scheduleVehicleIcon, { backgroundColor: scheduleRoute.route.color }]}>
                          <MaterialCommunityIcons name="bus" size={16} color="#FFF" />
                        </View>
                        <View style={styles.scheduleVehicleInfo}>
                          <Text style={styles.scheduleVehicleId}>Bus #{vehicle.id}</Text>
                          <Text style={styles.scheduleVehicleSpeed}>
                            {vehicle.speed > 0 ? `${Math.round(vehicle.speed)} mph` : 'Stopped'}
                          </Text>
                        </View>
                        {vehicle.occupancy && (
                          <View style={[styles.scheduleVehicleOccupancy, { backgroundColor: getOccupancyColor(vehicle.occupancy) + '20' }]}>
                            <Ionicons name="people" size={12} color={getOccupancyColor(vehicle.occupancy)} />
                            <Text style={[styles.scheduleVehicleOccupancyText, { color: getOccupancyColor(vehicle.occupancy) }]}>
                              {getOccupancyLabel(vehicle.occupancy)}
                            </Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },

  // Search Screen
  searchContainer: {
    flex: 1,
  },
  searchContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  searchHeader: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  searchTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: palette.textPrimary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  searchSubtitle: {
    fontSize: 14,
    color: palette.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: spacing.md,
    ...shadows.card,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: palette.textPrimary,
    paddingVertical: spacing.md,
  },
  clearButton: {
    padding: spacing.xs,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  loadingText: {
    fontSize: 14,
    color: palette.textSecondary,
  },
  suggestionsContainer: {
    marginTop: spacing.sm,
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
    ...shadows.card,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: palette.textPrimary,
  },
  popularSection: {
    marginTop: spacing.xl,
  },
  popularTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.textPrimary,
    marginBottom: spacing.md,
  },
  popularGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  popularChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: palette.surface,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  popularChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  activeRoutesSection: {
    marginTop: spacing.xl,
  },
  activeRoutesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  activeRoutesTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  activeRoutesLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  noActiveRoutes: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  noActiveRoutesText: {
    fontSize: 14,
    color: palette.textMuted,
  },
  activeRoutesList: {
    gap: spacing.sm,
  },
  activeRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    borderLeftWidth: 4,
    padding: spacing.md,
    gap: spacing.sm,
    ...shadows.card,
  },
  activeRouteBadge: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeRouteRowName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  activeRouteRowInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  activeRouteVehicles: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeRouteVehicleCount: {
    fontSize: 12,
    color: palette.success,
    fontWeight: '600',
  },
  activeRouteOccupancy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activeRouteOccupancyText: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Results Screen
  resultsContainer: {
    flex: 1,
  },
  resultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
  },
  backButton: {
    padding: spacing.sm,
    marginRight: spacing.sm,
  },
  resultsHeaderText: {
    flex: 1,
  },
  resultsTitle: {
    fontSize: 12,
    color: palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  destinationName: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  newSearchButton: {
    padding: spacing.sm,
    backgroundColor: palette.background,
    borderRadius: radii.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.textPrimary,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontSize: 14,
    color: palette.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  tryAgainButton: {
    marginTop: spacing.lg,
    backgroundColor: palette.brand,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  tryAgainText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  routesListScroll: {
    flex: 1,
  },
  routesList: {
    padding: spacing.md,
    paddingBottom: 100,
    gap: spacing.sm,
  },
  routeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
    ...shadows.card,
  },
  routeCardFirst: {
    borderColor: palette.brand,
    borderWidth: 2,
  },
  routeCardLeft: {
    marginRight: spacing.md,
  },
  routeColorBadge: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeCardContent: {
    flex: 1,
  },
  routeName: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  stopName: {
    fontSize: 13,
    color: palette.textSecondary,
    marginTop: 2,
  },
  routeStops: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  stopNameSmall: {
    fontSize: 12,
    color: palette.textSecondary,
    flex: 1,
  },
  locationFoundText: {
    fontSize: 12,
    color: palette.success,
    marginTop: spacing.sm,
  },
  routeMeta: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: palette.textMuted,
  },
  routeCardRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  etaText: {
    fontSize: 14,
    fontWeight: '700',
  },
  etaActive: {
    color: palette.success,
  },
  etaInactive: {
    color: palette.textMuted,
  },

  // Tracking Screen
  trackingContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  floatingBackButton: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    padding: spacing.sm,
    ...shadows.elevated,
  },
  liveBusMarkerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveBusMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  liveBusPulse: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 193, 7, 0.3)',
    zIndex: -1,
  },
  animatedBusContainer: {
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  busLottie: {
    width: 70,
    height: 70,
    position: 'absolute',
  },
  busColorOverlay: {
    width: 28,
    height: 40,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 6,
  },
  busWindshield: {
    width: 20,
    height: 10,
    backgroundColor: 'rgba(200, 230, 255, 0.9)',
    borderRadius: 3,
    marginBottom: 4,
  },
  busDirectionArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FFF',
    position: 'absolute',
    top: -8,
  },
  animatedStopContainer: {
    width: 70,
    height: 90,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  stopLottie: {
    width: 70,
    height: 90,
    position: 'absolute',
    top: 0,
  },
  stopIconOverlay: {
    alignItems: 'center',
    marginTop: 8,
  },
  stopIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  stopLabelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 4,
  },
  stopLabelBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  routeEndpointContainer: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeEndpointLottie: {
    width: 50,
    height: 50,
  },
  routeEndpoint: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  routeStartPoint: {
    backgroundColor: palette.success,
  },
  routeEndPoint: {
    backgroundColor: palette.danger,
  },
  stopMarkerContainer: {
    alignItems: 'center',
  },
  stopMarkerPin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  boardingPin: {
    backgroundColor: palette.success,
  },
  alightingPin: {
    backgroundColor: palette.brand,
  },
  stopMarkerArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
  },
  boardingArrow: {
    borderTopColor: palette.success,
  },
  alightingArrow: {
    borderTopColor: palette.brand,
  },
  stopLabel: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 4,
  },
  boardingLabel: {
    backgroundColor: palette.success,
  },
  alightingLabel: {
    backgroundColor: palette.brand,
  },
  stopLabelText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  destinationMarkerContainer: {
    alignItems: 'center',
  },
  destinationMarkerPin: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.brand,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    ...shadows.elevated,
  },
  destinationMarkerArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: palette.brand,
    marginTop: -3,
  },
  stopMarker: {
    backgroundColor: palette.surface,
    borderRadius: 10,
    padding: 4,
    borderWidth: 2,
    borderColor: palette.textPrimary,
  },
  trackingInfoCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: MODAL_MAX_HEIGHT,
    backgroundColor: palette.surface,
    borderTopLeftRadius: radii.xl + 6,
    borderTopRightRadius: radii.xl + 6,
    ...shadows.elevated,
  },
  handleBarContainer: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  handleBar: {
    width: 40,
    height: 5,
    backgroundColor: palette.border,
    borderRadius: 3,
  },
  modalScrollView: {
    flex: 1,
  },
  modalScrollContent: {
    paddingBottom: spacing.xl + 40,
  },
  trackingHeaderNew: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.sm,
    borderRadius: radii.lg,
  },
  trackingHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  trackingHeaderInfo: {
    flex: 1,
  },
  trackingRouteNameNew: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
    marginRight: 6,
  },
  liveText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
  },
  etaBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  etaBadgeText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
  },
  etaBadgeLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  journeyTimeline: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  timelineIconContainer: {
    alignItems: 'center',
    marginRight: spacing.md,
  },
  timelineIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineIconStart: {
    backgroundColor: palette.success,
  },
  timelineIconEnd: {
    backgroundColor: palette.brand,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: palette.border,
    marginVertical: 4,
    minHeight: 20,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: spacing.md,
  },
  timelineLabel: {
    fontSize: 11,
    color: palette.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  timelineValue: {
    fontSize: 15,
    fontWeight: '700',
    color: palette.textPrimary,
    marginTop: 2,
  },
  timelineMeta: {
    fontSize: 12,
    color: palette.textSecondary,
    marginTop: 2,
  },
  occupancyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  occupancyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  liveFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    marginTop: spacing.sm,
    marginHorizontal: spacing.lg,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.success,
    marginRight: 8,
  },
  liveFooterText: {
    fontSize: 12,
    color: palette.textMuted,
  },
  userLocationMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userLocationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#007AFF',
    borderWidth: 2,
    borderColor: '#FFF',
  },

  // Schedule Modal
  scheduleModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  scheduleModalContent: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    maxHeight: '80%',
  },
  scheduleModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
  },
  scheduleModalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  scheduleModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
  },
  scheduleModalLive: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  scheduleModalLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
    marginRight: 6,
  },
  scheduleModalLiveText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  scheduleModalClose: {
    padding: spacing.xs,
  },
  scheduleModalBody: {
    padding: spacing.lg,
    paddingBottom: spacing.xl + 20,
  },
  scheduleModalSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.md,
  },
  scheduleModalLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  scheduleModalEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  scheduleModalEmptyText: {
    fontSize: 14,
    color: palette.textMuted,
  },
  scheduleStopsList: {
    gap: 0,
  },
  scheduleStopItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 48,
  },
  scheduleStopTimeline: {
    width: 24,
    alignItems: 'center',
  },
  scheduleStopDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  scheduleStopDotFirst: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  scheduleStopLine: {
    width: 2,
    flex: 1,
    marginVertical: 4,
    opacity: 0.4,
  },
  scheduleStopInfo: {
    flex: 1,
    paddingLeft: spacing.sm,
    paddingBottom: spacing.md,
  },
  scheduleStopName: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.textPrimary,
  },
  scheduleStopDesc: {
    fontSize: 12,
    color: palette.textMuted,
    marginTop: 2,
  },
  scheduleVehiclesList: {
    gap: spacing.sm,
  },
  scheduleVehicleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.background,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  scheduleVehicleIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scheduleVehicleInfo: {
    flex: 1,
  },
  scheduleVehicleId: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.textPrimary,
  },
  scheduleVehicleSpeed: {
    fontSize: 12,
    color: palette.textMuted,
  },
  scheduleVehicleOccupancy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  scheduleVehicleOccupancyText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
