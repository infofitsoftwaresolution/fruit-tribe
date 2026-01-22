import { motion } from 'motion/react';
import { Users, Award, TrendingUp, Globe } from 'lucide-react';

export function StatsSection() {
  const stats = [
    {
      icon: Users,
      value: '50,000+',
      label: 'Happy Customers',
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'from-blue-50 to-cyan-50',
    },
    {
      icon: Award,
      value: '100+',
      label: 'Fruit Varieties',
      color: 'from-orange-500 to-amber-500',
      bgColor: 'from-orange-50 to-amber-50',
    },
    {
      icon: TrendingUp,
      value: '4.9/5.0',
      label: 'Customer Rating',
      color: 'from-green-500 to-teal-500',
      bgColor: 'from-green-50 to-teal-50',
    },
    {
      icon: Globe,
      value: '20+',
      label: 'Countries Served',
      color: 'from-purple-500 to-pink-500',
      bgColor: 'from-purple-50 to-pink-50',
    },
  ];

  return (
    <section className="py-20 bg-gradient-to-b from-white to-orange-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ y: -10, scale: 1.05 }}
              className={`relative bg-gradient-to-br ${stat.bgColor} rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all group overflow-hidden`}
            >
              {/* Animated Background */}
              <motion.div
                className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}
              />

              {/* Floating Particles */}
              <motion.div
                className="absolute -top-10 -right-10 w-32 h-32 bg-white/20 rounded-full blur-2xl"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.3, 0.6, 0.3],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />

              {/* Icon */}
              <motion.div
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.6 }}
                className={`w-16 h-16 rounded-2xl bg-gradient-to-r ${stat.color} flex items-center justify-center mb-4 shadow-lg relative z-10`}
              >
                <stat.icon className="w-8 h-8 text-white" />
              </motion.div>

              {/* Value */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 + 0.2 }}
                className="text-4xl md:text-5xl font-bold mb-2 relative z-10"
              >
                <span className={`bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                  {stat.value}
                </span>
              </motion.div>

              {/* Label */}
              <p className="text-gray-700 font-medium relative z-10">{stat.label}</p>

              {/* Glow Effect */}
              <motion.div
                className={`absolute inset-0 bg-gradient-to-r ${stat.color} opacity-0 group-hover:opacity-20 blur-2xl transition-opacity duration-500`}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
