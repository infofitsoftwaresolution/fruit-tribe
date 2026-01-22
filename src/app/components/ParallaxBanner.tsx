import { motion, useScroll, useTransform } from 'motion/react';
import { useRef } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function ParallaxBanner() {
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const y = useTransform(scrollYProgress, [0, 1], ['-20%', '20%']);
  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [0.5, 1, 0.5]);

  return (
    <div ref={containerRef} className="relative">
      <section className="relative h-[600px] overflow-hidden">
        {/* Parallax Background */}
        <motion.div
          style={{ y }}
          className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=1920')] bg-cover bg-center"
        >
          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/70" />
        </motion.div>

        {/* Content */}
        <motion.div
          style={{ opacity }}
          className="relative z-10 h-full flex items-center justify-center"
        >
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full mb-6 border border-white/20">
                <Sparkles className="w-4 h-4 text-orange-400" />
                <span className="text-sm font-medium text-white">
                  Premium Quality Guarantee
                </span>
              </div>

              <h2 className="text-5xl md:text-7xl font-bold text-white mb-6">
                Farm to Table
                <br />
                <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
                  In 24 Hours
                </span>
              </h2>

              <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
                Experience the difference of truly fresh fruits, picked at peak ripeness and delivered straight to your door
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <motion.button
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/products')}
                  className="px-8 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-full font-bold shadow-2xl hover:shadow-orange-500/50 transition-all flex items-center justify-center gap-2 group"
                >
                  Start Shopping
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => navigate('/about')}
                  className="px-8 py-4 bg-white/10 backdrop-blur-sm text-white rounded-full font-bold border-2 border-white/30 hover:bg-white/20 transition-all"
                >
                  Our Story
                </motion.button>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Floating Elements */}
        <motion.div
          animate={{
            y: [0, -20, 0],
            rotate: [0, 5, -5, 0],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute top-20 left-20 text-6xl opacity-30"
        >
          🍎
        </motion.div>

        <motion.div
          animate={{
            y: [0, 20, 0],
            rotate: [0, -5, 5, 0],
          }}
          transition={{
            duration: 7,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
          className="absolute bottom-20 right-20 text-6xl opacity-30"
        >
          🥭
        </motion.div>
      </section>
    </div>
  );
}
