import { motion } from 'motion/react';
import { ChefHat, Clock, Users, ArrowRight } from 'lucide-react';

export function RecipesSection() {
  const recipes = [
    {
      title: 'Tropical Mango Smoothie Bowl',
      image: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800',
      time: '10 mins',
      servings: '2',
      description: 'A refreshing and nutritious breakfast bowl packed with vitamins',
      ingredients: ['2 mangoes', 'Banana', 'Coconut milk', 'Granola'],
      gradient: 'from-yellow-400 to-orange-500',
    },
    {
      title: 'Berry Blast Parfait',
      image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800',
      time: '15 mins',
      servings: '4',
      description: 'Layered perfection with fresh berries, yogurt, and honey',
      ingredients: ['Strawberries', 'Blueberries', 'Greek yogurt', 'Honey'],
      gradient: 'from-pink-400 to-purple-500',
    },
    {
      title: 'Fresh Fruit Salad',
      image: 'https://images.unsplash.com/photo-1603046891726-36bfd957e243?w=800',
      time: '20 mins',
      servings: '6',
      description: 'A colorful mix of seasonal fruits with mint and lime',
      ingredients: ['Mixed fruits', 'Mint leaves', 'Lime juice', 'Honey'],
      gradient: 'from-green-400 to-teal-500',
    },
  ];

  return (
    <section className="py-20 bg-gradient-to-b from-white to-orange-50/50 relative overflow-hidden">
      {/* Background Decorations */}
      <div className="absolute inset-0 opacity-20">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          className="absolute top-20 right-20 text-9xl"
        >
          🍓
        </motion.div>
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-20 left-20 text-9xl"
        >
          🥭
        </motion.div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 rounded-full mb-4">
            <ChefHat className="w-4 h-4 text-orange-600" />
            <span className="text-sm font-medium text-orange-800">Fresh Recipes</span>
          </div>

          <h2 className="text-5xl md:text-6xl font-bold mb-4">
            <span className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
              Delicious Recipe Ideas
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Get inspired with these amazing fruit recipes you can make at home
          </p>
        </motion.div>

        {/* Recipes Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {recipes.map((recipe, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -10 }}
              className="bg-white rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition-all group"
            >
              {/* Recipe Image */}
              <div className="relative h-64 overflow-hidden">
                <motion.img
                  src={recipe.image}
                  alt={recipe.title}
                  className="w-full h-full object-cover"
                  whileHover={{ scale: 1.1 }}
                  transition={{ duration: 0.4 }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                
                {/* Recipe Badge */}
                <div className="absolute top-4 right-4">
                  <div className={`px-4 py-2 bg-gradient-to-r ${recipe.gradient} text-white rounded-full text-sm font-bold shadow-lg`}>
                    New Recipe
                  </div>
                </div>

                {/* Time & Servings */}
                <div className="absolute bottom-4 left-4 flex gap-3">
                  <div className="flex items-center gap-1 px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-sm font-medium">
                    <Clock className="w-4 h-4 text-orange-600" />
                    {recipe.time}
                  </div>
                  <div className="flex items-center gap-1 px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-sm font-medium">
                    <Users className="w-4 h-4 text-orange-600" />
                    {recipe.servings}
                  </div>
                </div>
              </div>

              {/* Recipe Content */}
              <div className="p-6">
                <h3 className="text-2xl font-bold text-gray-800 mb-3">
                  {recipe.title}
                </h3>
                <p className="text-gray-600 mb-4">
                  {recipe.description}
                </p>

                {/* Ingredients Preview */}
                <div className="mb-4">
                  <h4 className="text-sm font-bold text-gray-800 mb-2">Key Ingredients:</h4>
                  <div className="flex flex-wrap gap-2">
                    {recipe.ingredients.map((ingredient, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 bg-orange-50 text-orange-800 rounded-full text-xs font-medium"
                      >
                        {ingredient}
                      </span>
                    ))}
                  </div>
                </div>

                {/* View Recipe Button */}
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className={`w-full py-3 bg-gradient-to-r ${recipe.gradient} text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group`}
                >
                  View Full Recipe
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </motion.button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* View All Recipes Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center mt-12"
        >
          <motion.button
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            className="px-8 py-4 bg-white text-gray-800 rounded-full font-semibold shadow-lg hover:shadow-xl transition-all border-2 border-orange-200 hover:border-orange-400"
          >
            Browse All Recipes
          </motion.button>
        </motion.div>
      </div>
    </section>
  );
}
