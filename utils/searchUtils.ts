export interface Venue {
  name: string;
  type: string;
  distance: number;
  tags: string[];
}

export function searchVenues(venues: Venue[], query: string): Venue[] {
  if (!query.trim()) {
    return venues;
  }

  const searchTerm = query.toLowerCase().trim();
  
  return venues.filter(venue => {
    // Search by name
    const matchesName = venue.name.toLowerCase().includes(searchTerm);
    
    // Search by type
    const matchesType = venue.type.toLowerCase().includes(searchTerm);
    
    // Search by tags
    const matchesTags = venue.tags.some(tag => 
      tag.toLowerCase().includes(searchTerm)
    );

    return matchesName || matchesType || matchesTags;
  });
}
