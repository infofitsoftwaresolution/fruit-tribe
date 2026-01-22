import { motion } from 'motion/react';
import { Facebook, Instagram, Twitter, Mail, Phone, MapPin, Leaf } from 'lucide-react';
import { Link } from 'react-router-dom';
import logo from '@/assets/logo.png';

export function Footer() {
  const socialLinks = [
    { icon: Facebook, href: '#', label: 'Facebook' },
    { icon: Instagram, href: '#', label: 'Instagram' },
    { icon: Twitter, href: '#', label: 'Twitter' },
  ];

  const quickLinks = [
    { name: 'Home', path: '/' },
    { name: 'Products', path: '/products' },
    { name: 'About', path: '/about' },
    { name: 'Contact', path: '/contact' },
  ];

  const categories = [
    'Tropical Fruits',
    'Berries',
    'Citrus Fruits',
    'Exotic Fruits',
    'Seasonal Fruits',
    'Organic Selection',
  ];

  return (
    <footer className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute inset-0 overflow-hidden opacity-10">
        <motion.div
          className="absolute top-0 right-0 w-96 h-96 bg-orange-500 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute bottom-0 left-0 w-96 h-96 bg-green-500 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.5, 0.3, 0.5],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* Brand Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Link to="/" className="flex items-center gap-3 mb-4">
              <motion.img
                src={logo}
                alt="The Fruit Tribe"
                className="h-16 w-auto object-contain"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.3 }}
              />
            </Link>
            <p className="text-gray-400 mb-6 leading-relaxed">
              Your trusted source for fresh, organic fruits delivered straight to your door. Quality and freshness guaranteed.
            </p>
            
            {/* Social Links */}
            <div className="flex gap-3">
              {socialLinks.map((social, index) => (
                <motion.a
                  key={index}
                  href={social.href}
                  whileHover={{ scale: 1.1, y: -3 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-10 h-10 bg-gradient-to-r from-orange-600 to-amber-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all"
                  aria-label={social.label}
                >
                  <social.icon className="w-5 h-5 text-white" />
                </motion.a>
              ))}
            </div>
          </motion.div>

          {/* Quick Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Leaf className="w-5 h-5 text-orange-500" />
              Quick Links
            </h3>
            <ul className="space-y-3">
              {quickLinks.map((link, index) => (
                <li key={index}>
                  <Link to={link.path}>
                    <motion.div
                      whileHover={{ x: 5 }}
                      className="text-gray-400 hover:text-orange-400 transition-colors flex items-center gap-2"
                    >
                      <span className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                      {link.name}
                    </motion.div>
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Categories */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Leaf className="w-5 h-5 text-orange-500" />
              Categories
            </h3>
            <ul className="space-y-3">
              {categories.map((category, index) => (
                <li key={index}>
                  <motion.div
                    whileHover={{ x: 5 }}
                    className="text-gray-400 hover:text-orange-400 transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <span className="w-1.5 h-1.5 bg-orange-500 rounded-full" />
                    {category}
                  </motion.div>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Contact Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Leaf className="w-5 h-5 text-orange-500" />
              Contact Us
            </h3>
            <div className="space-y-4">
              <motion.div
                whileHover={{ x: 5 }}
                className="flex items-start gap-3 text-gray-400 hover:text-orange-400 transition-colors cursor-pointer"
              >
                <MapPin className="w-5 h-5 text-orange-500 mt-1 flex-shrink-0" />
                <span>123 Fruit Street, Fresh City, FC 12345</span>
              </motion.div>
              
              <motion.div
                whileHover={{ x: 5 }}
                className="flex items-center gap-3 text-gray-400 hover:text-orange-400 transition-colors cursor-pointer"
              >
                <Phone className="w-5 h-5 text-orange-500 flex-shrink-0" />
                <span>+1 (555) 123-4567</span>
              </motion.div>
              
              <motion.div
                whileHover={{ x: 5 }}
                className="flex items-center gap-3 text-gray-400 hover:text-orange-400 transition-colors cursor-pointer"
              >
                <Mail className="w-5 h-5 text-orange-500 flex-shrink-0" />
                <span>hello@fruittribe.com</span>
              </motion.div>
            </div>

            {/* Newsletter */}
            <div className="mt-6">
              <p className="text-sm text-gray-400 mb-3">Subscribe to our newsletter</p>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Your email"
                  className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-orange-500 transition-colors"
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-600 rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all"
                >
                  <Mail className="w-5 h-5" />
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bottom Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="pt-8 border-t border-gray-700"
        >
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-400 text-sm text-center md:text-left">
              © 2026 The Fruit Tribe. All rights reserved. | Fresh & Natural
            </p>
            
            <div className="flex gap-6 text-sm text-gray-400">
              <motion.a whileHover={{ y: -2 }} href="#" className="hover:text-orange-400 transition-colors">
                Privacy Policy
              </motion.a>
              <motion.a whileHover={{ y: -2 }} href="#" className="hover:text-orange-400 transition-colors">
                Terms of Service
              </motion.a>
              <motion.a whileHover={{ y: -2 }} href="#" className="hover:text-orange-400 transition-colors">
                Cookie Policy
              </motion.a>
            </div>
          </div>
        </motion.div>
      </div>
    </footer>
  );
}