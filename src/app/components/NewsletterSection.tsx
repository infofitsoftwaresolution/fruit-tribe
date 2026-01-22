import { motion } from 'motion/react';
import { Mail, Gift, Sparkles, ArrowRight } from 'lucide-react';
import { useState } from 'react';

export function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubscribed(true);
    setTimeout(() => {
      setIsSubscribed(false);
      setEmail('');
    }, 3000);
  };

  return (
    <section className="py-20 relative overflow-hidden">
      {/* Animated Gradient Background */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600"
        animate={{
          backgroundPosition: ['0% 0%', '100% 100%', '0% 0%'],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear"
        }}
      />

      {/* Pattern Overlay */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-full h-full" style={{
          backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
          backgroundSize: '50px 50px',
        }} />
      </div>

      {/* Floating Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-6xl opacity-20"
            initial={{
              x: Math.random() * window.innerWidth,
              y: Math.random() * 500,
            }}
            animate={{
              y: [Math.random() * 500, -100],
              rotate: [0, 360],
            }}
            transition={{
              duration: 10 + Math.random() * 10,
              repeat: Infinity,
              delay: Math.random() * 5,
            }}
          >
            {['🍊', '🍓', '🍇', '🍍'][Math.floor(Math.random() * 4)]}
          </motion.div>
        ))}
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center text-white"
        >
          {/* Icon */}
          <motion.div
            animate={{
              y: [0, -20, 0],
              rotate: [0, 10, -10, 0],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="inline-block mb-6"
          >
            <div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto">
              <Mail className="w-12 h-12 text-white" />
            </div>
          </motion.div>

          {/* Title */}
          <h2 className="text-5xl md:text-6xl font-bold mb-6">
            Get Fresh Updates!
          </h2>
          
          <p className="text-xl text-white/90 mb-12 max-w-2xl mx-auto leading-relaxed">
            Subscribe to our newsletter and get <span className="font-bold">20% OFF</span> your first order plus exclusive deals and healthy recipes!
          </p>

          {/* Benefits */}
          <div className="flex flex-wrap justify-center gap-6 mb-12">
            {[
              { icon: Gift, text: '20% OFF First Order' },
              { icon: Sparkles, text: 'Exclusive Deals' },
              { icon: Mail, text: 'Weekly Recipes' },
            ].map((benefit, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.1, y: -5 }}
                className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-6 py-3 rounded-full"
              >
                <benefit.icon className="w-5 h-5" />
                <span className="font-semibold">{benefit.text}</span>
              </motion.div>
            ))}
          </div>

          {/* Subscription Form */}
          {!isSubscribed ? (
            <motion.form
              onSubmit={handleSubmit}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="max-w-md mx-auto"
            >
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="Enter your email"
                    className="w-full pl-12 pr-4 py-4 rounded-full bg-white text-gray-800 font-medium focus:outline-none focus:ring-4 focus:ring-white/50 shadow-lg"
                  />
                </div>
                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.05, x: 5 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-4 bg-white text-orange-600 rounded-full font-bold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  Subscribe
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              </div>
              <p className="text-white/80 text-sm mt-4">
                We respect your privacy. Unsubscribe anytime.
              </p>
            </motion.form>
          ) : (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="max-w-md mx-auto"
            >
              <div className="bg-white/20 backdrop-blur-sm rounded-3xl p-8">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4"
                >
                  <Sparkles className="w-10 h-10 text-white" />
                </motion.div>
                <h3 className="text-2xl font-bold mb-2">Welcome to the Tribe!</h3>
                <p className="text-white/90">
                  Check your email for your exclusive 20% OFF coupon code!
                </p>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Bottom Wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
          <motion.path
            d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
            fill="white"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2 }}
          />
        </svg>
      </div>
    </section>
  );
}
