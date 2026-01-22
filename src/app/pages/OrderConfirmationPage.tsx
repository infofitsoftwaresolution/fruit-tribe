import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { CheckCircle, Package, Home, ShoppingBag } from 'lucide-react';

export function OrderConfirmationPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-green-50 flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl"
      >
        <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12 text-center">
          {/* Success Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle className="w-16 h-16 text-green-600" />
          </motion.div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
              Order Confirmed!
            </span>
          </h1>

          <p className="text-xl text-gray-600 mb-8">
            Thank you for your order. We've received it and will start processing it right away.
          </p>

          {/* Order Details */}
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Package className="w-6 h-6 text-orange-600" />
              <h2 className="text-2xl font-bold text-gray-800">Order #12345</h2>
            </div>
            <p className="text-gray-600 mb-2">
              You will receive an email confirmation shortly with your order details.
            </p>
            <p className="text-gray-600">
              Estimated delivery: <strong>2-3 business days</strong>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/">
              <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
              >
                <Home className="w-5 h-5" />
                Back to Home
              </motion.button>
            </Link>
            <Link to="/products">
              <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                className="w-full sm:w-auto px-8 py-4 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
              >
                <ShoppingBag className="w-5 h-5" />
                Continue Shopping
              </motion.button>
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
