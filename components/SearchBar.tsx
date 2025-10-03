import { Search, X } from 'lucide-react-native';
import React, { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

interface SearchBarProps {
  onSearchChange: (query: string) => void;
}

export default function SearchBar({ onSearchChange }: SearchBarProps) {
  const [query, setQuery] = useState('');

  const handleSearchChange = (text: string) => {
    setQuery(text);
    onSearchChange(text);
  };

  const clearSearch = () => {
    setQuery('');
    onSearchChange('');
  };

  return (
    <View>
      <View style={styles.searchContainer}>
        <Search size={20} color="#6b7280" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, type, ect."
          placeholderTextColor="#9ca3af"
          value={query}
          onChangeText={handleSearchChange}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <X 
            size={20} 
            color="#6b7280" 
            style={styles.clearIcon}
            onPress={clearSearch}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 5,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  clearIcon: {
    marginLeft: 8,
    padding: 4,
  },
});
