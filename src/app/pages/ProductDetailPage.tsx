import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { ShoppingCart, Heart, Star, Minus, Plus, ArrowLeft, Truck, Shield, Check } from 'lucide-react';

interface ProductDetailPageProps {
  onAddToCart: (id: number) => void;
}

const productData: { [key: number]: any } = {
  1: {
    name: 'Premium Alphonso Mango',
    price: 12.99,
    image: 'https://images.unsplash.com/photo-1734163075572-8948e799e42c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyaXBlJTIwbWFuZ28lMjBmcnVpdHxlbnwxfHx8fDE3Njg1NDg2ODl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    description: 'The king of mangoes - sweet and aromatic',
    fullDescription: 'Premium Alphonso mangoes are known as the "King of Mangoes" for their exceptional sweetness, rich flavor, and creamy texture. Grown in the finest orchards, these mangoes are hand-picked at peak ripeness to ensure maximum flavor and nutrition.',
    rating: 4.8,
    reviews: 234,
    category: 'Tropical',
    origin: 'India',
    nutrition: {
      calories: 60,
      carbs: '15g',
      fiber: '1.6g',
      vitaminC: '36%',
    },
  },
  2: {
    name: 'Fresh Strawberries',
    price: 8.99,
    image: 'https://images.unsplash.com/photo-1570767531016-b21faba25ea1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMHN0cmF3YmVycmllcyUyMGJhc2tldHxlbnwxfHx8fDE3Njg1NTk0NjZ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    description: 'Juicy and perfectly ripe strawberries',
    fullDescription: 'Fresh, juicy strawberries picked at the peak of ripeness. These berries are bursting with natural sweetness and are perfect for snacking, desserts, or adding to your morning smoothie.',
    rating: 4.9,
    reviews: 189,
    category: 'Berries',
    origin: 'California',
    nutrition: {
      calories: 32,
      carbs: '7.7g',
      fiber: '2g',
      vitaminC: '97%',
    },
  },
  3: {
    name: 'Organic Blueberries',
    price: 9.99,
    image: 'https://images.unsplash.com/photo-1554495644-8ce87fe3e713?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxibHVlYmVycmllcyUyMGJvd2x8ZW58MXx8fHwxNzY4NDc0NTIzfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    description: 'Antioxidant-rich organic blueberries',
    fullDescription: 'Certified organic blueberries packed with antioxidants and vitamins. These small but mighty fruits are perfect for boosting your immune system and adding a burst of flavor to any dish.',
    rating: 4.7,
    reviews: 156,
    category: 'Berries',
    origin: 'Maine',
    nutrition: {
      calories: 57,
      carbs: '14.5g',
      fiber: '2.4g',
      vitaminC: '16%',
    },
  },
  4: {
    name: 'Juicy Oranges',
    price: 7.99,
    image: 'https://images.unsplash.com/photo-1634781326658-8734696bb6d9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvcmFuZ2UlMjBjaXRydXMlMjBmcnVpdHxlbnwxfHx8fDE3Njg0NjE5ODd8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    description: 'Vitamin C packed fresh oranges',
    fullDescription: 'Fresh, juicy oranges bursting with vitamin C. Perfect for a healthy snack or freshly squeezed juice. These oranges are hand-selected for their sweetness and juiciness.',
    rating: 4.6,
    reviews: 278,
    category: 'Citrus',
    origin: 'Florida',
    nutrition: {
      calories: 47,
      carbs: '11.8g',
      fiber: '2.4g',
      vitaminC: '88%',
    },
  },
  5: {
    name: 'Crisp Red Apples',
    price: 6.99,
    image: 'https://images.unsplash.com/photo-1623815242959-fb20354f9b8d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyZWQlMjBhcHBsZSUyMGZyZXNofGVufDF8fHx8MTc2ODQ5MzIwMnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    description: 'Crisp and sweet red apples',
    fullDescription: 'Crisp, sweet red apples with a perfect balance of tartness. These apples are great for snacking, baking, or adding to salads.',
    rating: 4.5,
    reviews: 312,
    category: 'Regular',
    origin: 'Washington',
    nutrition: {
      calories: 52,
      carbs: '13.8g',
      fiber: '2.4g',
      vitaminC: '7%',
    },
  },
  6: {
    name: 'Sweet Watermelon',
    price: 11.99,
    image: 'https://images.unsplash.com/photo-1629265824943-b0a19b32c7a0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3YXRlcm1lbG9uJTIwc2xpY2VkJTIwZnJlc2h8ZW58MXx8fHwxNzY4NTU5NDY4fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    description: 'Refreshing and hydrating watermelon',
    fullDescription: 'Sweet, refreshing watermelon perfect for hot summer days. High in water content and natural sugars, making it a hydrating and delicious treat.',
    rating: 4.8,
    reviews: 145,
    category: 'Regular',
    origin: 'Texas',
    nutrition: {
      calories: 30,
      carbs: '7.6g',
      fiber: '0.4g',
      vitaminC: '13%',
    },
  },
  7: {
    name: 'Purple Grapes',
    price: 10.99,
    image: 'https://images.unsplash.com/photo-1567663803965-967e472241e3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwdXJwbGUlMjBncmFwZXMlMjBidW5jaHxlbnwxfHx8fDE3Njg1NTk0Njh8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    description: 'Sweet and juicy purple grapes',
    fullDescription: 'Sweet, juicy purple grapes perfect for snacking. These grapes are naturally sweet and packed with antioxidants.',
    rating: 4.7,
    reviews: 198,
    category: 'Regular',
    origin: 'California',
    nutrition: {
      calories: 62,
      carbs: '16g',
      fiber: '0.9g',
      vitaminC: '4%',
    },
  },
  8: {
    name: 'Golden Pineapple',
    price: 8.99,
    image: 'https://images.unsplash.com/photo-1472352255192-75fb1f6b329c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwaW5lYXBwbGUlMjB0cm9waWNhbCUyMGZydWl0fGVufDF8fHx8MTc2ODU1OTQ2OHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    description: 'Tropical golden pineapple',
    fullDescription: 'Sweet, tropical golden pineapple with a perfect balance of sweetness and acidity. Great for eating fresh or adding to tropical dishes.',
    rating: 4.6,
    reviews: 167,
    category: 'Tropical',
    origin: 'Hawaii',
    nutrition: {
      calories: 50,
      carbs: '13g',
      fiber: '1.4g',
      vitaminC: '79%',
    },
  },
  9: {
    name: 'Organic Bananas',
    price: 5.99,
    image: 'https://images.unsplash.com/photo-1711208224791-2cc390f53744?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYW5hbmElMjBidW5jaCUyMHllbGxvd3xlbnwxfHx8fDE3Njg1NTk0Njl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    description: 'Organic yellow bananas',
    fullDescription: 'Certified organic bananas, naturally sweet and perfect for a quick energy boost. Great for smoothies, baking, or eating on the go.',
    rating: 4.5,
    reviews: 289,
    category: 'Regular',
    origin: 'Ecuador',
    nutrition: {
      calories: 89,
      carbs: '23g',
      fiber: '2.6g',
      vitaminC: '14%',
    },
  },
  10: {
    name: 'Fresh Kiwi',
    price: 9.99,
    image: 'https://images.unsplash.com/photo-1699029330848-335e7e2c073f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxraXdpJTIwZnJ1aXQlMjBzbGljZWR8ZW58MXx8fHwxNzY4NTU5NDY5fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    description: 'Fresh and tangy kiwi fruit',
    fullDescription: 'Fresh, tangy kiwi fruit packed with vitamin C and fiber. The perfect balance of sweet and tart flavors.',
    rating: 4.7,
    reviews: 134,
    category: 'Exotic',
    origin: 'New Zealand',
    nutrition: {
      calories: 61,
      carbs: '14.7g',
      fiber: '3g',
      vitaminC: '154%',
    },
  },
  11: {
    name: 'Juicy Peaches',
    price: 10.99,
    image: 'https://images.unsplash.com/photo-1642372849486-f88b963cb734?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwZWFjaCUyMGZydWl0JTIwZnJlc2h8ZW58MXx8fHwxNzY4NTU5NDY5fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    description: 'Sweet and juicy peaches',
    fullDescription: 'Sweet, juicy peaches with a perfect balance of sweetness and acidity. Great for eating fresh, baking, or making preserves.',
    rating: 4.8,
    reviews: 201,
    category: 'Regular',
    origin: 'Georgia',
    nutrition: {
      calories: 39,
      carbs: '9.5g',
      fiber: '1.5g',
      vitaminC: '11%',
    },
  },
  12: {
    name: 'Exotic Dragon Fruit',
    price: 14.99,
    image: 'https://images.unsplash.com/photo-1654786733736-aefca0247a5e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkcmFnb24lMjBmcnVpdCUyMHBpbmt8ZW58MXx8fHwxNzY4NTU5NDcwfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    description: 'Exotic and nutrient-dense superfruit',
    fullDescription: 'Exotic dragon fruit, a nutrient-dense superfruit with a unique appearance and mild, sweet flavor. Packed with antioxidants and vitamins.',
    rating: 4.9,
    reviews: 98,
    category: 'Exotic',
    origin: 'Vietnam',
    nutrition: {
      calories: 60,
      carbs: '13g',
      fiber: '3g',
      vitaminC: '3%',
    },
  },
};

export function ProductDetailPage({ onAddToCart }: ProductDetailPageProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState(1);
  const [isLiked, setIsLiked] = useState(false);

  const productId = id ? parseInt(id) : 0;
  const product = productData[productId];

  if (!product) {
    return (
      <div className="pt-24 pb-16 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">Product Not Found</h1>
          <Link to="/products" className="text-orange-600 hover:underline">
            Back to Products
          </Link>
        </div>
      </div>
    );
  }

  const handleAddToCart = () => {
    for (let i = 0; i < quantity; i++) {
      onAddToCart(productId);
    }
  };

  return (
    <div className="pt-24 pb-16 min-h-screen bg-gradient-to-b from-white to-orange-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 hover:text-orange-600 mb-8 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </motion.button>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Image Section */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative"
          >
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-orange-100 to-amber-100 shadow-2xl">
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-[600px] object-cover"
              />
            </div>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsLiked(!isLiked)}
              className="absolute top-6 right-6 p-4 bg-white/90 backdrop-blur-sm rounded-full shadow-lg"
            >
              <Heart
                className={`w-6 h-6 ${
                  isLiked ? 'fill-red-500 text-red-500' : 'text-gray-600'
                }`}
              />
            </motion.button>
          </motion.div>

          {/* Details Section */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div>
              <span className="inline-block px-4 py-2 bg-orange-100 text-orange-800 rounded-full text-sm font-semibold mb-4">
                {product.category}
              </span>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
                {product.name}
              </h1>
              <div className="flex items-center gap-4 mb-6">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-5 h-5 ${
                        i < Math.floor(product.rating)
                          ? 'fill-amber-400 text-amber-400'
                          : 'fill-gray-200 text-gray-200'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-lg font-semibold text-gray-700">
                  {product.rating}
                </span>
                <span className="text-gray-500">({product.reviews} reviews)</span>
              </div>
            </div>

            {/* Price */}
            <div className="flex items-baseline gap-4">
              <span className="text-5xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                ${product.price}
              </span>
              <span className="text-gray-500 text-lg">/lb</span>
            </div>

            {/* Description */}
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-3">Description</h2>
              <p className="text-gray-600 leading-relaxed">{product.fullDescription}</p>
            </div>

            {/* Nutrition Info */}
            <div className="bg-white rounded-2xl p-6 shadow-md">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Nutrition Facts</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-600">Calories:</span>
                  <span className="ml-2 font-semibold">{product.nutrition.calories}</span>
                </div>
                <div>
                  <span className="text-gray-600">Carbs:</span>
                  <span className="ml-2 font-semibold">{product.nutrition.carbs}</span>
                </div>
                <div>
                  <span className="text-gray-600">Fiber:</span>
                  <span className="ml-2 font-semibold">{product.nutrition.fiber}</span>
                </div>
                <div>
                  <span className="text-gray-600">Vitamin C:</span>
                  <span className="ml-2 font-semibold">{product.nutrition.vitaminC}</span>
                </div>
              </div>
            </div>

            {/* Quantity Selector */}
            <div className="flex items-center gap-4">
              <span className="text-lg font-semibold text-gray-700">Quantity:</span>
              <div className="flex items-center gap-3 bg-white rounded-xl p-2 shadow-md">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Minus className="w-5 h-5 text-gray-600" />
                </motion.button>
                <span className="w-12 text-center text-xl font-bold text-gray-800">
                  {quantity}
                </span>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setQuantity(quantity + 1)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Plus className="w-5 h-5 text-gray-600" />
                </motion.button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <motion.button
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleAddToCart}
                className="flex-1 py-4 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
              >
                <ShoppingCart className="w-5 h-5" />
                Add to Cart
              </motion.button>
            </div>

            {/* Features */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-gray-200">
              <div className="text-center">
                <Truck className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-700">Free Shipping</p>
                <p className="text-xs text-gray-500">Over $50</p>
              </div>
              <div className="text-center">
                <Shield className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-700">Quality Assured</p>
                <p className="text-xs text-gray-500">100% Fresh</p>
              </div>
              <div className="text-center">
                <Check className="w-8 h-8 text-orange-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-700">Easy Returns</p>
                <p className="text-xs text-gray-500">30 Days</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
