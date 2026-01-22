import { useState } from 'react';
import { motion } from 'motion/react';
import { ProductCard } from '@/app/components/ProductCard';
import { Search, Filter, Grid, List } from 'lucide-react';

interface ProductsPageProps {
  onAddToCart: (id: number) => void;
}

const allProducts = [
  {
    id: 1,
    name: 'Premium Alphonso Mango',
    price: 12.99,
    image: 'https://images.unsplash.com/photo-1734163075572-8948e799e42c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyaXBlJTIwbWFuZ28lMjBmcnVpdHxlbnwxfHx8fDE3Njg1NDg2ODl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    description: 'The king of mangoes - sweet and aromatic',
    badge: 'Bestseller',
    category: 'Tropical',
  },
  {
    id: 2,
    name: 'Fresh Strawberries',
    price: 8.99,
    image: 'https://images.unsplash.com/photo-1570767531016-b21faba25ea1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMHN0cmF3YmVycmllcyUyMGJhc2tldHxlbnwxfHx8fDE3Njg1NTk0NjZ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    description: 'Juicy and perfectly ripe strawberries',
    badge: 'Popular',
    category: 'Berries',
  },
  {
    id: 3,
    name: 'Organic Blueberries',
    price: 9.99,
    image: 'https://images.unsplash.com/photo-1554495644-8ce87fe3e713?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxibHVlYmVycmllcyUyMGJvd2x8ZW58MXx8fHwxNzY4NDc0NTIzfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    description: 'Antioxidant-rich organic blueberries',
    badge: 'Organic',
    category: 'Berries',
  },
  {
    id: 4,
    name: 'Juicy Oranges',
    price: 7.99,
    image: 'https://images.unsplash.com/photo-1634781326658-8734696bb6d9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvcmFuZ2UlMjBjaXRydXMlMjBmcnVpdHxlbnwxfHx8fDE3Njg0NjE5ODd8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    description: 'Vitamin C packed fresh oranges',
    badge: 'Fresh',
    category: 'Citrus',
  },
  {
    id: 5,
    name: 'Crisp Red Apples',
    price: 6.99,
    image: 'https://images.unsplash.com/photo-1623815242959-fb20354f9b8d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyZWQlMjBhcHBsZSUyMGZyZXNofGVufDF8fHx8MTc2ODQ5MzIwMnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    description: 'Crisp and sweet red apples',
    badge: 'Fresh',
    category: 'Regular',
  },
  {
    id: 6,
    name: 'Sweet Watermelon',
    price: 11.99,
    image: 'https://images.unsplash.com/photo-1629265824943-b0a19b32c7a0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3YXRlcm1lbG9uJTIwc2xpY2VkJTIwZnJlc2h8ZW58MXx8fHwxNzY4NTU5NDY4fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    description: 'Refreshing and hydrating watermelon',
    badge: 'Seasonal',
    category: 'Regular',
  },
  {
    id: 7,
    name: 'Purple Grapes',
    price: 10.99,
    image: 'https://images.unsplash.com/photo-1567663803965-967e472241e3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwdXJwbGUlMjBncmFwZXMlMjBidW5jaHxlbnwxfHx8fDE3Njg1NTk0Njh8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    description: 'Sweet and juicy purple grapes',
    badge: 'Fresh',
    category: 'Regular',
  },
  {
    id: 8,
    name: 'Golden Pineapple',
    price: 8.99,
    image: 'https://images.unsplash.com/photo-1472352255192-75fb1f6b329c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwaW5lYXBwbGUlMjB0cm9waWNhbCUyMGZydWl0fGVufDF8fHx8MTc2ODU1OTQ2OHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    description: 'Tropical golden pineapple',
    badge: 'Tropical',
    category: 'Tropical',
  },
  {
    id: 9,
    name: 'Organic Bananas',
    price: 5.99,
    image: 'https://images.unsplash.com/photo-1711208224791-2cc390f53744?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYW5hbmElMjBidW5jaCUyMHllbGxvd3xlbnwxfHx8fDE3Njg1NTk0Njl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    description: 'Organic yellow bananas',
    badge: 'Organic',
    category: 'Regular',
  },
  {
    id: 10,
    name: 'Fresh Kiwi',
    price: 9.99,
    image: 'https://images.unsplash.com/photo-1699029330848-335e7e2c073f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxraXdpJTIwZnJ1aXQlMjBzbGljZWR8ZW58MXx8fHwxNzY4NTU5NDY5fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    description: 'Fresh and tangy kiwi fruit',
    badge: 'Fresh',
    category: 'Exotic',
  },
  {
    id: 11,
    name: 'Juicy Peaches',
    price: 10.99,
    image: 'https://images.unsplash.com/photo-1642372849486-f88b963cb734?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwZWFjaCUyMGZydWl0JTIwZnJlc2h8ZW58MXx8fHwxNzY4NTU5NDY5fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    description: 'Sweet and juicy peaches',
    badge: 'Seasonal',
    category: 'Regular',
  },
  {
    id: 12,
    name: 'Exotic Dragon Fruit',
    price: 14.99,
    image: 'https://images.unsplash.com/photo-1654786733736-aefca0247a5e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkcmFnb24lMjBmcnVpdCUyMHBpbmt8ZW58MXx8fHwxNzY4NTU5NDcwfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    description: 'Exotic and nutrient-dense superfruit',
    badge: 'Exotic',
    category: 'Exotic',
  },
];

export function ProductsPage({ onAddToCart }: ProductsPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const categories = ['All', 'Tropical', 'Berries', 'Citrus', 'Regular', 'Exotic'];

  const filteredProducts = allProducts.filter((product) => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="pt-24 pb-16 min-h-screen bg-gradient-to-b from-white to-orange-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
              Our Products
            </span>
          </h1>
          <p className="text-xl text-gray-600">Discover our wide selection of fresh fruits</p>
        </motion.div>

        {/* Filters and Search */}
        <div className="mb-8 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search fruits..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white rounded-2xl border-2 border-gray-200 focus:border-orange-500 focus:outline-none shadow-md"
            />
          </div>

          {/* Category Filter and View Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-5 h-5 text-gray-600" />
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-full font-semibold transition-all ${
                    selectedCategory === category
                      ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-lg'
                      : 'bg-white text-gray-700 hover:bg-orange-50 border-2 border-gray-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 bg-white rounded-xl p-1 border-2 border-gray-200">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === 'grid'
                    ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Grid className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === 'list'
                    ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <p className="text-gray-600 mb-6">
          Showing {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
        </p>

        {/* Products Grid/List */}
        {filteredProducts.length > 0 ? (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8'
                : 'space-y-4'
            }
          >
            {filteredProducts.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <ProductCard
                  id={product.id}
                  name={product.name}
                  price={product.price}
                  image={product.image}
                  description={product.description}
                  badge={product.badge}
                  onAddToCart={onAddToCart}
                />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-xl text-gray-600 mb-4">No products found</p>
            <p className="text-gray-500">Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
