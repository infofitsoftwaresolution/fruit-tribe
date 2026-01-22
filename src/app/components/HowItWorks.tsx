import { motion } from 'motion/react';
import { MousePointerClick, Package, Truck, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export function HowItWorks() {
  const steps = [
    {
      icon: MousePointerClick,
      title: 'Browse & Select',
      description: 'Choose from our wide variety of fresh, premium fruits',
      number: '01',
      color: 'from-orange-500 to-amber-500',
    },
    {
      icon: Package,
      title: 'We Pack Fresh',
      description: 'Your order is carefully packed with love and care',
      number: '02',
      color: 'from-green-500 to-teal-500',
    },
    {
      icon: Truck,
      title: 'Fast Delivery',
      description: 'Delivered to your doorstep within 24 hours',
      number: '03',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: CheckCircle,
      title: 'Enjoy Fresh!',
      description: 'Taste the difference with every bite',
      number: '04',
      color: 'from-purple-500 to-pink-500',
    },
  ];

  return (
    <section className="py-20 bg-gradient-to-b from-orange-50 to-white relative overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute inset-0">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/4 left-1/4 w-64 h-64 bg-orange-200/30 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-green-200/30 rounded-full blur-3xl"
        />
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
          <h2 className="text-5xl md:text-6xl font-bold mb-4">
            <span className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
              How It Works
            </span>
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Getting fresh fruits delivered to your door is as easy as 1-2-3-4
          </p>
        </motion.div>

        {/* Steps Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
          {/* Connecting Line (desktop only) */}
          <div className="hidden lg:block absolute top-24 left-0 right-0 h-1">
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.5, delay: 0.5 }}
              className="h-full bg-gradient-to-r from-orange-400 via-green-400 via-blue-400 to-purple-400 origin-left"
            />
          </div>

          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
              className="relative"
            >
              <motion.div
                whileHover={{ y: -10, scale: 1.03 }}
                className="bg-white rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all relative overflow-hidden group"
              >
                {/* Number Badge */}
                <div className="absolute top-6 right-6">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    whileInView={{ scale: 1, rotate: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.2 + 0.3 }}
                    className={`w-16 h-16 rounded-full bg-gradient-to-r ${step.color} flex items-center justify-center shadow-lg`}
                  >
                    <span className="text-2xl font-bold text-white">{step.number}</span>
                  </motion.div>
                </div>

                {/* Animated Background Gradient */}
                <motion.div
                  className={`absolute inset-0 bg-gradient-to-br ${step.color} opacity-0 group-hover:opacity-5 transition-opacity duration-500`}
                />

                {/* Icon */}
                <motion.div
                  whileHover={{ rotate: 360, scale: 1.1 }}
                  transition={{ duration: 0.6 }}
                  className={`w-20 h-20 rounded-2xl bg-gradient-to-r ${step.color} flex items-center justify-center mb-6 shadow-lg relative z-10`}
                >
                  <step.icon className="w-10 h-10 text-white" />
                </motion.div>

                {/* Content */}
                <h3 className="text-2xl font-bold text-gray-800 mb-3 relative z-10">
                  {step.title}
                </h3>
                <p className="text-gray-600 leading-relaxed relative z-10">
                  {step.description}
                </p>

                {/* Decorative Circle */}
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
                  className={`absolute -bottom-10 -right-10 w-32 h-32 bg-gradient-to-r ${step.color} rounded-full blur-2xl`}
                />
              </motion.div>

              {/* Arrow Connector (desktop only) */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-24 -right-4 z-20">
                  <motion.div
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.2 + 0.6 }}
                    className="w-8 h-8 bg-white rounded-full border-4 border-orange-400 shadow-lg"
                  />
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {/* Call to Action */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="text-center mt-16"
        >
          <Link to="/products">
            <motion.div
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              className="inline-block px-10 py-4 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-full font-semibold shadow-lg hover:shadow-xl transition-all text-lg cursor-pointer"
            >
              Start Shopping Now
            </motion.div>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
