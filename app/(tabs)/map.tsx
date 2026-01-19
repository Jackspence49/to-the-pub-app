import React from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Region } from 'react-native-maps';


export default function MapScreen() {
  // Boston region coordinates
  const bostonRegion: Region = {
    latitude: 42.34105265628477,
    longitude: -71.0521475972448,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={bostonRegion}
        showsUserLocation={true}
        showsMyLocationButton={true}
        showsCompass={false}
        showsScale={true}
        showsBuildings={false}
        showsTraffic={false}
        showsIndoors={false}
        showsPointsOfInterest={false}
        mapType="standard"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
});
