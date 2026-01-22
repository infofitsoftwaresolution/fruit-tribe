import { motion } from 'motion/react';
import { Sun, Snowflake, Flower2, Leaf, Calendar } from 'lucide-react';

export function SeasonalHighlights() {
  const currentSeason = 'Winter'; // This could be dynamic based on actual date

  const seasons = [
    {
      name: 'Spring',
      icon: Flower2,
      color: 'from-pink-500 to-rose-500',
      bgColor: 'from-pink-50 to-rose-50',
      fruits: ['Strawberries', 'Cherries', 'Apricots'],
      description: 'Fresh blooms bring sweet delights',
      active: false,
    },
    {
      name: 'Summer',
      icon: Sun,
      color: 'from-yellow-500 to-orange-500',
      bgColor: 'from-yellow-50 to-orange-50',
      fruits: ['Watermelon', 'Peaches', 'Mangoes'],
      description: 'Juicy treats for sunny days',
      active: false,
    },
    {
      name: 'Fall',
      icon: Leaf,
      color: 'from-orange-500 to-red-500',
      bgColor: 'from-orange-50 to-red-50',
      fruits: ['Apples', 'Pears', 'Grapes'],
      description: 'Harvest season\'s finest',
      active: false,
    },
    {
      name: 'Winter',
      icon: Snowflake,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'from-blue-50 to-cyan-50',
      fruits: ['Oranges', 'Kiwi', 'Dragon Fruit'],
      description: 'Exotic winter wonders',
      active: true,
    },
  ];

  const activeSeason = seasons.find(s => s.active) || seasons[0];

  return (
    <section className="py-20 bg-gradient-to-b from-orange-50 to-white relative overflow-hidden">
      {/* Seasonal Decorations */}
      <div className="absolute inset-0 opacity-10">
        <motion.div
          animate={{
            y: [0, -30, 0],
            rotate: [0, 10, -10, 0],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute top-20 left-20 text-8xl"
        >
          ❄️
        </motion.div>
        <motion.div
          animate={{
            y: [0, 30, 0],
            rotate: [0, -10, 10, 0],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute bottom-20 right-20 text-8xl"
        >
          🍊
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
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 rounded-full mb-4">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">Seasonal Selection</span>
          </div>

          <h2 className="text-5xl md:text-6xl font-bold mb-4">
            <span className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
              {activeSeason.name} Favorites
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Discover the freshest fruits of the season, handpicked for peak flavor
          </p>
        </motion.div>

        {/* Seasons Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {seasons.map((season, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -10, scale: 1.02 }}
              className={`relative bg-gradient-to-br ${season.bgColor} rounded-3xl p-6 shadow-lg hover:shadow-2xl transition-all group overflow-hidden ${
                season.active ? 'ring-4 ring-blue-400' : ''
              }`}
            >
              {/* Active Badge */}
              {season.active && (
                <div className="absolute top-4 right-4">
                  <span className="px-3 py-1 bg-blue-500 text-white text-xs font-bold rounded-full shadow-lg">
                    Now
                  </span>
                </div>
              )}

              {/* Glow Effect */}
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.1, 0.2, 0.1],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: index * 0.3,
                }}
                className={`absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-r ${season.color} rounded-full blur-3xl`}
              />

              {/* Icon */}
              <motion.div
                whileHover={{ rotate: 360, scale: 1.1 }}
                transition={{ duration: 0.6 }}
                className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${season.color} flex items-center justify-center mb-4 shadow-lg relative z-10 mx-auto`}
              >
                <season.icon className="w-8 h-8 text-white" />
              </motion.div>

              {/* Content */}
              <h3 className="text-2xl font-bold text-gray-800 mb-2 text-center relative z-10">
                {season.name}
              </h3>
              <p className="text-sm text-gray-600 mb-4 text-center relative z-10">
                {season.description}
              </p>

              {/* Fruits */}
              <div className="space-y-2 relative z-10">
                {season.fruits.map((fruit, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-sm text-gray-700 bg-white/50 rounded-lg px-3 py-2"
                  >
                    <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${season.color}`} />
                    {fruit}
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Featured Banner */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className={`bg-gradient-to-r ${activeSeason.color} rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden`}
        >
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-20">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
              className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl"
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
              className="absolute bottom-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl"
            />
          </div>

          <div className="relative z-10 grid md:grid-cols-2 gap-8 items-center">
            {/* Left Content */}
            <div className="text-white">
              <div className="flex items-center gap-3 mb-4">
                <activeSeason.icon className="w-12 h-12" />
                <h3 className="text-4xl md:text-5xl font-bold">
                  {activeSeason.name} Special
                </h3>
              </div>
              <p className="text-xl text-white/90 mb-6">
                Get 20% off on all {activeSeason.name.toLowerCase()} fruits! Limited time offer.
              </p>
              <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 bg-white text-gray-800 rounded-full font-bold shadow-lg hover:shadow-xl transition-all"
              >
                Shop {activeSeason.name} Collection
              </motion.button>
            </div>

            {/* Right - Featured Fruits */}
            <div className="grid grid-cols-3 gap-4">
              {activeSeason.fruits.map((fruit, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 text-center"
                >
                  <div className="text-4xl mb-2">🍊</div>
                  <p className="text-white font-semibold text-sm">{fruit}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
