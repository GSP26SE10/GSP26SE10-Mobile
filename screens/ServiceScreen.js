import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BottomNavigation from '../components/BottomNavigation';
import { TEXT_PRIMARY, BACKGROUND_WHITE, PRIMARY_COLOR, TEXT_SECONDARY, BORDER_LIGHT } from '../constants/colors';

const { width } = Dimensions.get('window');

// Mock service data
const getServices = () => {
  const decorationImageUrl = 'https://toniparty.vn/wp-content/uploads/2023/10/Set-trang-tri-sinh-nhat-tone-hong-trang-2.jpg';
  const baseImageUrl = 'https://scontent.fsgn16-1.fna.fbcdn.net/v/t39.30808-6/548570477_1189728099855961_5240077253445441952_n.jpg?_nc_cat=100&ccb=1-7&_nc_sid=127cfc&_nc_ohc=Lqp7XKTpjhEQ7kNvwGmL7JP&_nc_oc=AdlFm094dgSxWykFEBHlV5urvU6TtYvqvBW6vGbcWA82Mvri8OXfcl2mq02l7coDg9n7jaq7KjGdKQ3oAFYMnzGc&_nc_zt=23&_nc_ht=scontent.fsgn16-1.fna&_nc_gid=QckBobUcEcuU-15xcs2WdA&oh=00_AfuoPMLP6B9c7ArmiRL3hG_mzjPAZa_aRe3Yl5zro9aGxw&oe=698954C8';
  
  return [
    {
      id: 1,
      name: 'Trang trí sinh nhật',
      price: '199.000₫',
      image: decorationImageUrl,
    },
    {
      id: 2,
      name: 'Thuê dàn karaoke',
      price: '299.000₫',
      image: baseImageUrl,
    },
    {
      id: 3,
      name: 'Thuê 10 bộ bàn ghế',
      price: '150.000₫',
      image: baseImageUrl,
    },
    {
      id: 4,
      name: 'Trang trí sinh nhật',
      price: '199.000₫',
      image: decorationImageUrl,
    },
    {
      id: 5,
      name: 'Thuê dàn karaoke',
      price: '299.000₫',
      image: baseImageUrl,
    },
    {
      id: 6,
      name: 'Thuê 10 bộ bàn ghế',
      price: '150.000₫',
      image: baseImageUrl,
    },
  ];
};

export default function ServiceScreen({ navigation }) {
  const [searchQuery, setSearchQuery] = useState('');
  const services = getServices();

  const handleAddService = (service) => {
    console.log('Add service:', service);
    // TODO: Implement add service functionality
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={TEXT_SECONDARY} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm dịch vụ..."
            placeholderTextColor={TEXT_SECONDARY}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <TouchableOpacity style={styles.filterButton} activeOpacity={0.7}>
            <Ionicons name="options" size={20} color={TEXT_PRIMARY} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Services List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {services.map((service) => (
          <View key={service.id} style={styles.serviceCard}>
            <Image
              source={{ uri: service.image }}
              style={styles.serviceImage}
              resizeMode="cover"
            />
            <View style={styles.serviceInfo}>
              <Text style={styles.serviceName}>{service.name}</Text>
              <Text style={styles.servicePrice}>{service.price}</Text>
            </View>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => handleAddService(service)}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={20} color={TEXT_PRIMARY} />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <BottomNavigation activeTab="Search" onTabPress={(tab) => navigation.navigate(tab)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND_WHITE,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 12,
    height: 48,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: TEXT_PRIMARY,
    padding: 0,
  },
  filterButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 100,
    paddingHorizontal: 20,
  },
  serviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  serviceImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#E0E0E0',
  },
  serviceInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  serviceName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
    marginBottom: 6,
  },
  servicePrice: {
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    textDecorationLine: 'underline',
  },
  addButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: TEXT_PRIMARY,
    backgroundColor: BACKGROUND_WHITE,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});
