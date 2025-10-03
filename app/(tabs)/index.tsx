import { MapPin } from 'lucide-react-native';
import React, { useMemo, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import SearchBar from '../../components/SearchBar';
import { searchVenues, Venue } from '../../utils/searchUtils';



const VenueCard = ({ name, type, distance, tags }: Venue) => (
  <View style={styles.card}>
    <Text style={styles.title}>{name}</Text>
    <Text style={styles.subtitle}>{type}</Text>
    <View style={styles.row}>
      <MapPin size={16} color="#4b5563" style={{ marginRight: 4 }} />
      <Text style={styles.meta}>{distance} miles away</Text>
    </View>
    <View style={styles.tagsRow}>
      {tags.map((tag: string, index: number) => (
        <View key={index} style={styles.tag}>
          <Text style={styles.tagText}>{tag}</Text>
        </View>
      ))}
    </View>
  </View>
);

export default function VenueListing() {
  const [searchQuery, setSearchQuery] = useState('');
  const [hasScrolledFromSearch, setHasScrolledFromSearch] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const venues: Venue[] = [
    {
      name: 'Bar Volpe',
      type: 'Restaurant',
      distance: 0.1,
      tags: ['Upscale', 'Food Service', 'Outdoor Seating']
    },
    {
      name: 'Sheas Tavern',
      type: 'Dive Bar',
      distance: 0.1,
      tags: ['Cash Only']
    },
    {
      name: 'LULU GREEN',
      type: 'Restaurant',
      distance: 0.1,
      tags: ['Food Service', 'Upscale']
    },
    {
      name: 'Croke Park',
      type: 'Dive Bar',
      distance: 0.1,
      tags: ['Pool Tables', 'Darts', 'Cash Only']
    },
    {
      name: 'Amrheins Restaurant',
      type: 'Restaurant',
      distance: 0.2,
      tags: ['Food Service', 'Outdoor Seating']
    },
    {
      name: 'Layla American Tavern',
      type: 'Restaurant',
      distance: 0.2,
      tags: ['Food Service', 'Outdoor Seating']
    },
    {
      name: 'Clock Tavern',
      type: 'Restaurant',
      distance: 0.2,
      tags: ['Food Service', 'Outdoor Seating']
    },
    {
      name: 'Layla American Tavern',
      type: 'Restaurant',
      distance: 0.2,
      tags: ['Food Service', 'Outdoor Seating']
    },
    {
      name: "Layla's American Tavern",
      type: 'Restaurant',
      distance: 0.2,
      tags: ['Food Service', 'Outdoor Seating']
    },
    {
      name: 'Layla American Tavern',
      type: 'Restaurant',
      distance: 0.2,
      tags: ['Food Service', 'Outdoor Seating']
    },
    {
      name: 'Layla American Tavern',
      type: 'Restaurant',
      distance: 0.2,
      tags: ['Food Service', 'Outdoor Seating']
    }
  ];

  // Memoize filtered venues
  const filteredVenues = useMemo(() => 
    searchVenues(venues, searchQuery), 
    [venues, searchQuery]
  );

  // Handle search change and scroll to top only on initial type
  const handleSearchChange = (query: string) => {
    const previousQuery = searchQuery;
    setSearchQuery(query);
    
    // Only scroll to top if:
    // 1. User is typing (query length > 0)
    // 2. This is the first keystroke (previous query was empty)
    // 3. User hasn't manually scrolled away from search results
    if (query.length > 0 && previousQuery.length === 0 && !hasScrolledFromSearch) {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }
    
    // Reset scroll flag when clearing search
    if (query.length === 0) {
      setHasScrolledFromSearch(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Sticky Search Bar */}
      <View style={styles.stickyHeader}>
        <View style={styles.header}>
          <Image source={require('../../assets/images/ToThePub-logo.png')} style={styles.logoImage} />
        </View>
        <SearchBar onSearchChange={handleSearchChange} />
      </View>
      
      {/* Scrollable Content */}
      <ScrollView 
        ref={scrollViewRef}
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={(event) => {
          // Track if user manually scrolls away from top after searching
          const scrollY = event.nativeEvent.contentOffset.y;
          if (searchQuery.length > 0 && scrollY > 100) {
            setHasScrolledFromSearch(true);
          }
        }}
        scrollEventThrottle={16}
      >
        {filteredVenues.length > 0 ? (
          filteredVenues.map((venue, index) => (
            <VenueCard key={index} {...venue} />
          ))
        ) : (
          <View style={styles.noResultsContainer}>
            <Text style={styles.noResultsText}>No venues found matching your search criteria</Text>
            <Text style={styles.noResultsSubtext}>Try adjusting your filters or search terms</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  stickyHeader: {
    backgroundColor: '#ffffff',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  header: {
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  logoImage: {
    width: 120,
    height: 60,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    color: '#6b7280',
    fontSize: 14,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  meta: {
    color: '#4b5563',
    fontSize: 14,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#22d3ee',
  },
  tagText: {
    color: '#06b6d4',
    fontSize: 14,
    fontWeight: '600',
  },
  noResultsContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 8,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});