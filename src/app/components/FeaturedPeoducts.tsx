import { motion } from 'motion/react';
import { ProductCard } from '@/app/components/ProductCard';
import { Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

interface FeaturedProductsProps {
  onAddToCart: (id: number) => void;
}

export function FeaturedProducts({ onAddToCart }: FeaturedProductsProps) {
  const featuredProducts = [
    {
      id: 1,
      name: 'Premium Alphonso Mango',
      price: 12.99,
      image: 'https://images.unsplash.com/photo-1734163075572-8948e799e42c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyaXBlJTIwbWFuZ28lMjBmcnVpdHxlbnwxfHx8fDE3Njg1NDg2ODl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
      description: 'The king of mangoes - sweet and aromatic',
      badge: 'Bestseller',
    },
    {
      id: 2,
      name: 'Fresh Strawberries',
      price: 8.99,
      image: 'https://images.unsplash.com/photo-1570767531016-b21faba25ea1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMHN0cmF3YmVycmllcyUyMGJhc2tldHxlbnwxfHx8fDE3Njg1NTk0NjZ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
      description: 'Juicy and perfectly ripe strawberries',
      badge: 'Popular',
    },
    {
      id: 3,
      name: 'Organic Blueberries',
      price: 9.99,
      image: 'https://images.unsplash.com/photo-1554495644-8ce87fe3e713?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxibHVlYmVycmllcyUyMGJvd2x8ZW58MXx8fHwxNzY4NDc0NTIzfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
      description: 'Antioxidant-rich organic blueberries',
      badge: 'Organic',
    },
    {
      id: 4,
      name: 'Juicy Oranges',
      price: 7.99,
      image: 'https://images.unsplash.com/photo-1634781326658-8734696bb6d9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvcmFuZ2UlMjBjaXRydXMlMjBmcnVpdHxlbnwxfHx8fDE3Njg0NjE5ODd8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
      description: 'Vitamin C packed fresh oranges',
      badge: 'Fresh',
    },
    {
      id: 12,
      name: 'Exotic Dragon Fruit',
      price: 14.99,
      image: 'https://images.unsplash.com/photo-1654786733736-aefca0247a5e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkcmFnb24lMjBmcnVpdCUyMHBpbmt8ZW58MXx8fHwxNzY4NTU5NDcwfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
      description: 'Exotic and nutrient-dense superfruit',
      badge: 'Exotic',
    },
    {
      id: 6,
      name: 'Sweet Watermelon',
      price: 11.99,
      image: 'https://images.unsplash.com/photo-1629265824943-b0a19b32c7a0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3YXRlcm1lbG9uJTIwc2xpY2VkJTIwZnJlc2h8ZW58MXx8fHwxNzY4NTU5NDY4fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
      description: 'Refreshing and hydrating watermelon',
      badge: 'Seasonal',
    },
  ];

  return (
    <section className="py-20 bg-gradient-to-b from-white to-orange-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 rounded-full mb-4">
            <Sparkles className="w-4 h-4 text-orange-600" />
            <span className="text-sm font-medium text-orange-800">Featured Collection</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
              Premium Selection
            </span>
          </h2>
          
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Handpicked fruits from the finest orchards, delivered fresh to your door
          </p>
        </motion.div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {featuredProducts.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
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

        {/* View All Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-center mt-12"
        >
          <Link to="/products">
            <motion.div
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              className="inline-block px-8 py-4 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-full font-semibold shadow-lg hover:shadow-xl transition-all cursor-pointer"
            >
              View All Products
            </motion.div>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}