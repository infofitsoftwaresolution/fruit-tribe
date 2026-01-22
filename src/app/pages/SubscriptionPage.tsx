import { useState } from 'react';
import { motion } from 'motion/react';
import { Check, Sparkles, Gift, Truck, Star } from 'lucide-react';

export function SubscriptionPage() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const plans = [
    {
      id: 'weekly',
      name: 'Weekly Box',
      price: 29.99,
      period: 'per week',
      description: 'Perfect for individuals or small families',
      features: [
        '5-7 lbs of fresh fruits',
        'Weekly delivery',
        'Free shipping',
        'Cancel anytime',
        'Mix of seasonal fruits',
      ],
      popular: false,
    },
    {
      id: 'biweekly',
      name: 'Bi-Weekly Box',
      price: 49.99,
      period: 'every 2 weeks',
      description: 'Great for regular fruit lovers',
      features: [
        '10-12 lbs of fresh fruits',
        'Bi-weekly delivery',
        'Free shipping',
        'Cancel anytime',
        'Premium selection',
        'Recipe cards included',
      ],
      popular: true,
    },
    {
      id: 'monthly',
      name: 'Monthly Box',
      price: 89.99,
      period: 'per month',
      description: 'Best value for large families',
      features: [
        '20-25 lbs of fresh fruits',
        'Monthly delivery',
        'Free shipping',
        'Cancel anytime',
        'Premium & exotic fruits',
        'Recipe cards included',
        'Priority customer support',
      ],
      popular: false,
    },
  ];

  return (
    <div className="pt-24 pb-16 min-h-screen bg-gradient-to-b from-white to-orange-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 rounded-full mb-4">
            <Sparkles className="w-4 h-4 text-orange-600" />
            <span className="text-sm font-medium text-orange-800">Subscription Plans</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            <span className="bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
              Fresh Fruits Delivered
            </span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Choose a subscription plan that fits your lifestyle. Get the freshest fruits delivered
            to your door on a schedule that works for you.
          </p>
        </motion.div>

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ y: -8 }}
              className={`relative bg-white rounded-3xl p-8 shadow-lg hover:shadow-2xl transition-all ${
                plan.popular ? 'ring-4 ring-orange-500 scale-105' : ''
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-full text-sm font-bold">
                  Most Popular
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-800 mb-2">{plan.name}</h3>
                <p className="text-gray-600 mb-4">{plan.description}</p>
                <div className="flex items-baseline justify-center gap-2">
                  <span className="text-5xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                    ${plan.price}
                  </span>
                  <span className="text-gray-600">/{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedPlan(plan.id)}
                className={`w-full py-4 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all ${
                  plan.popular
                    ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                Select Plan
              </motion.button>
            </motion.div>
          ))}
        </div>

        {/* Benefits Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-gradient-to-r from-orange-600 via-amber-600 to-orange-600 rounded-3xl p-12 text-white"
        >
          <h2 className="text-3xl font-bold mb-8 text-center">Why Subscribe?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Gift,
                title: 'Exclusive Discounts',
                description: 'Save up to 20% compared to one-time purchases',
              },
              {
                icon: Truck,
                title: 'Free Shipping',
                description: 'All subscription orders include free delivery',
              },
              {
                icon: Star,
                title: 'Premium Quality',
                description: 'Get first access to the finest seasonal selections',
              },
            ].map((benefit, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <benefit.icon className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold mb-2">{benefit.title}</h3>
                <p className="text-white/90">{benefit.description}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
