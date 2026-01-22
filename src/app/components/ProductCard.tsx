import { motion } from 'motion/react';
import { ShoppingCart, Heart, Star } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

interface ProductCardProps {
  id: number;
  name: string;
  price: number;
  image: string;
  description?: string;
  badge?: string;
  onAddToCart: (id: number) => void;
}

export function ProductCard({ id, name, price, image, description, badge, onAddToCart }: ProductCardProps) {
  const [isLiked, setIsLiked] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      whileHover={{ y: -8 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="relative bg-white rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 group"
    >
      {/* Badge */}
      {badge && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute top-4 left-4 z-20 px-3 py-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold rounded-full shadow-md"
        >
          {badge}
        </motion.div>
      )}

      {/* Like Button */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsLiked(!isLiked)}
        className="absolute top-4 right-4 z-20 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-md hover:shadow-lg transition-all"
      >
        <Heart
          className={`w-5 h-5 transition-colors ${
            isLiked ? 'fill-red-500 text-red-500' : 'text-gray-600'
          }`}
        />
      </motion.button>

      {/* Image Container */}
      <Link to={`/product/${id}`}>
        <div className="relative h-64 overflow-hidden bg-gradient-to-br from-orange-100 to-amber-100 cursor-pointer">
          <motion.img
            src={image}
            alt={name}
            className="w-full h-full object-cover"
            animate={{
              scale: isHovered ? 1.1 : 1,
            }}
            transition={{ duration: 0.4 }}
          />
          
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>
      </Link>

      {/* Content */}
      <div className="p-6">
        <div className="flex items-center gap-1 mb-2">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              className={`w-4 h-4 ${
                i < 4 ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200'
              }`}
            />
          ))}
          <span className="text-sm text-gray-500 ml-1">(4.8)</span>
        </div>

        <h3 className="text-xl font-bold text-gray-800 mb-2 line-clamp-1">
          {name}
        </h3>

        {description && (
          <p className="text-sm text-gray-600 mb-4 line-clamp-2">
            {description}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div>
            <span className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
              ${price}
            </span>
            <span className="text-gray-500 text-sm ml-1">/lb</span>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onAddToCart(id)}
            className="px-6 py-3 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-full font-semibold shadow-md hover:shadow-lg transition-all flex items-center gap-2"
          >
            <ShoppingCart className="w-4 h-4" />
            Add
          </motion.button>
        </div>
      </div>

      {/* Hover Effect Border */}
      <motion.div
        className="absolute inset-0 rounded-3xl border-2 border-transparent"
        animate={{
          borderColor: isHovered ? 'rgba(249, 115, 22, 0.3)' : 'rgba(0, 0, 0, 0)',
        }}
        transition={{ duration: 0.3 }}
      />
    </motion.div>
  );
}