import { motion } from 'motion/react';
import { ShoppingCart, Menu, X, Search, User, LogIn } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/context/AuthContext';
import logo from '@/assets/logo.png';

interface NavbarProps {
  cartCount: number;
  onCartClick: () => void;
}

export function Navbar({ cartCount, onCartClick }: NavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleAccountClick = () => {
    if (isAuthenticated) {
      navigate('/profile');
    } else {
      navigate('/login');
    }
  };

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-white/95 backdrop-blur-md shadow-lg' : 'bg-white/90 backdrop-blur-sm shadow-md'
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <Link to="/">
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="cursor-pointer flex items-center gap-3"
            >
              <motion.img
                src={logo}
                alt="The Fruit Tribe"
                className="h-14 w-auto object-contain"
                animate={{
                  rotate: [0, 2, -2, 0],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
            </motion.div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            {[
              { path: '/', label: 'Home' },
              { path: '/products', label: 'Products' },
              { path: '/subscription', label: 'Subscription' },
              { path: '/about', label: 'About' },
              { path: '/contact', label: 'Contact' },
            ].map((item, index) => (
              <Link key={item.path} to={item.path}>
                <motion.div
                  className="relative text-gray-700 hover:text-orange-600 transition-colors font-semibold group cursor-pointer text-base"
                  whileHover={{ y: -2 }}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  {item.label}
                  <motion.span
                    className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-orange-500 to-amber-500 group-hover:w-full transition-all duration-300"
                  />
                </motion.div>
              </Link>
            ))}
          </div>

          {/* Right Side Icons */}
          <div className="flex items-center space-x-3">
            <motion.button
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.95 }}
              className="p-3 rounded-full hover:bg-orange-50 transition-colors"
            >
              <Search className="w-6 h-6 text-gray-700" />
            </motion.button>

            {/* Account/Login Button - Fixed */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleAccountClick}
              className="p-3 rounded-full hover:bg-orange-50 transition-colors relative group"
            >
              {isAuthenticated ? (
                <User className="w-6 h-6 text-gray-700" />
              ) : (
                <LogIn className="w-6 h-6 text-gray-700" />
              )}
              {/* Tooltip */}
              <div className="absolute top-full mt-2 right-0 px-3 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                {isAuthenticated ? 'My Account' : 'Login'}
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={onCartClick}
              className="relative p-3 rounded-full hover:bg-orange-50 transition-colors"
            >
              <ShoppingCart className="w-6 h-6 text-gray-700" />
              {cartCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 bg-gradient-to-r from-orange-600 to-amber-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold shadow-lg"
                >
                  {cartCount}
                </motion.span>
              )}
            </motion.button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-3 rounded-full hover:bg-orange-50 transition-colors"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden py-4 space-y-3"
          >
            {[
              { path: '/', label: 'Home' },
              { path: '/products', label: 'Products' },
              { path: '/subscription', label: 'Subscription' },
              { path: '/about', label: 'About' },
              { path: '/contact', label: 'Contact' },
              { path: isAuthenticated ? '/profile' : '/login', label: isAuthenticated ? 'My Account' : 'Login' },
            ].map((item) => (
              <Link key={item.path} to={item.path} onClick={() => setIsMenuOpen(false)}>
                <div className="block py-2 text-gray-700 hover:text-orange-600 transition-colors font-medium">
                  {item.label}
                </div>
              </Link>
            ))}
          </motion.div>
        )}
      </div>
    </motion.nav>
  );
}