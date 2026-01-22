import { useState } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '@/app/context/AuthContext';
import { Navbar } from '@/app/components/Navbar';
import { Footer } from '@/app/components/Footer';
import { CartDrawer } from '@/app/components/CartDrawer';
import { ScrollToTop } from '@/app/components/ScrollToTop';
import { HomePage } from '@/app/pages/HomePage';
import { ProductsPage } from '@/app/pages/ProductsPage';
import { ProductDetailPage } from '@/app/pages/ProductDetailPage';
import { AboutPage } from '@/app/pages/AboutPage';
import { ContactPage } from '@/app/pages/ContactPage';
import { CartPage } from '@/app/pages/CartPage';
import { ProfilePage } from '@/app/pages/ProfilePage';
import { LoginPage } from '@/app/pages/LoginPage';
import { SignUpPage } from '@/app/pages/SignUpPage';
import { ForgotPasswordPage } from '@/app/pages/ForgotPasswordPage';
import { CheckoutPage } from '@/app/pages/CheckoutPage';
import { OrderConfirmationPage } from '@/app/pages/OrderConfirmationPage';
import { NotFoundPage } from '@/app/pages/NotFoundPage';
import { SubscriptionPage } from '@/app/pages/SubscriptionPage';

interface CartItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  image: string;
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-white">
      {children}
    </div>
  );
}

export default function App() {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Product data for cart
  const productData: { [key: number]: { name: string; price: number; image: string } } = {
    1: {
      name: 'Premium Alphonso Mango',
      price: 12.99,
      image: 'https://images.unsplash.com/photo-1734163075572-8948e799e42c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyaXBlJTIwbWFuZ28lMjBmcnVpdHxlbnwxfHx8fDE3Njg1NDg2ODl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    },
    2: {
      name: 'Fresh Strawberries',
      price: 8.99,
      image: 'https://images.unsplash.com/photo-1570767531016-b21faba25ea1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMHN0cmF3YmVycmllcyUyMGJhc2tldHxlbnwxfHx8fDE3Njg1NTk0NjZ8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    },
    3: {
      name: 'Organic Blueberries',
      price: 9.99,
      image: 'https://images.unsplash.com/photo-1554495644-8ce87fe3e713?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxibHVlYmVycmllcyUyMGJvd2x8ZW58MXx8fHwxNzY4NDc0NTIzfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    },
    4: {
      name: 'Juicy Oranges',
      price: 7.99,
      image: 'https://images.unsplash.com/photo-1634781326658-8734696bb6d9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvcmFuZ2UlMjBjaXRydXMlMjBmcnVpdHxlbnwxfHx8fDE3Njg0NjE5ODd8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    },
    5: {
      name: 'Crisp Red Apples',
      price: 6.99,
      image: 'https://images.unsplash.com/photo-1623815242959-fb20354f9b8d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyZWQlMjBhcHBsZSUyMGZyZXNofGVufDF8fHx8MTc2ODQ5MzIwMnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    },
    6: {
      name: 'Sweet Watermelon',
      price: 11.99,
      image: 'https://images.unsplash.com/photo-1629265824943-b0a19b32c7a0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3YXRlcm1lbG9uJTIwc2xpY2VkJTIwZnJlc2h8ZW58MXx8fHwxNzY4NTU5NDY4fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    },
    7: {
      name: 'Purple Grapes',
      price: 10.99,
      image: 'https://images.unsplash.com/photo-1567663803965-967e472241e3?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwdXJwbGUlMjBncmFwZXMlMjBidW5jaHxlbnwxfHx8fDE3Njg1NTk0Njh8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    },
    8: {
      name: 'Golden Pineapple',
      price: 8.99,
      image: 'https://images.unsplash.com/photo-1472352255192-75fb1f6b329c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwaW5lYXBwbGUlMjB0cm9waWNhbCUyMGZydWl0fGVufDF8fHx8MTc2ODU1OTQ2OHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    },
    9: {
      name: 'Organic Bananas',
      price: 5.99,
      image: 'https://images.unsplash.com/photo-1711208224791-2cc390f53744?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiYW5hbmElMjBidW5jaCUyMHllbGxvd3xlbnwxfHx8fDE3Njg1NTk0Njl8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    },
    10: {
      name: 'Fresh Kiwi',
      price: 9.99,
      image: 'https://images.unsplash.com/photo-1699029330848-335e7e2c073f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxraXdpJTIwZnJ1aXQlMjBzbGljZWR8ZW58MXx8fHwxNzY4NTU5NDY5fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    },
    11: {
      name: 'Juicy Peaches',
      price: 10.99,
      image: 'https://images.unsplash.com/photo-1642372849486-f88b963cb734?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwZWFjaCUyMGZydWl0JTIwZnJlc2h8ZW58MXx8fHwxNzY4NTU5NDY5fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    },
    12: {
      name: 'Exotic Dragon Fruit',
      price: 14.99,
      image: 'https://images.unsplash.com/photo-1654786733736-aefca0247a5e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkcmFnb24lMjBmcnVpdCUyMHBpbmt8ZW58MXx8fHwxNzY4NTU5NDcwfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
    },
  };

  const handleAddToCart = (productId: number) => {
    setCartItems((prevItems) => {
      const existingItem = prevItems.find((item) => item.id === productId);
      
      if (existingItem) {
        return prevItems.map((item) =>
          item.id === productId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        const product = productData[productId];
        if (!product) {
          console.error('Product not found:', productId);
          return prevItems;
        }
        return [
          ...prevItems,
          {
            id: productId,
            name: product.name,
            price: product.price,
            quantity: 1,
            image: product.image,
          },
        ];
      }
    });
    
    // Show cart drawer briefly
    setIsCartOpen(true);
  };

  const handleUpdateQuantity = (productId: number, change: number) => {
    setCartItems((prevItems) => {
      return prevItems
        .map((item) =>
          item.id === productId
            ? { ...item, quantity: Math.max(0, item.quantity + change) }
            : item
        )
        .filter((item) => item.quantity > 0);
    });
  };

  const handleRemoveItem = (productId: number) => {
    setCartItems((prevItems) => prevItems.filter((item) => item.id !== productId));
  };

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <AuthProvider>
      <Router>
        <AppRoutes
          cartCount={cartCount}
          cartItems={cartItems}
          isCartOpen={isCartOpen}
          setIsCartOpen={setIsCartOpen}
          handleAddToCart={handleAddToCart}
          handleUpdateQuantity={handleUpdateQuantity}
          handleRemoveItem={handleRemoveItem}
        />
      </Router>
    </AuthProvider>
  );
}

function AppRoutes({
  cartCount,
  cartItems,
  isCartOpen,
  setIsCartOpen,
  handleAddToCart,
  handleUpdateQuantity,
  handleRemoveItem,
}: {
  cartCount: number;
  cartItems: CartItem[];
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  handleAddToCart: (id: number) => void;
  handleUpdateQuantity: (id: number, change: number) => void;
  handleRemoveItem: (id: number) => void;
}) {
  return (
    <>
      <ScrollToTop />
      <Routes>
        {/* Auth Routes - No Navbar/Footer */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/order-confirmation" element={<OrderConfirmationPage />} />

        {/* Main Routes - With Navbar/Footer */}
        <Route
          path="/"
          element={
            <Layout>
              <Navbar cartCount={cartCount} onCartClick={() => setIsCartOpen(true)} />
              <HomePage onAddToCart={handleAddToCart} />
              <Footer />
              <CartDrawer
                isOpen={isCartOpen}
                onClose={() => setIsCartOpen(false)}
                items={cartItems}
                onUpdateQuantity={handleUpdateQuantity}
                onRemoveItem={handleRemoveItem}
              />
            </Layout>
          }
        />
        <Route
          path="/products"
          element={
            <Layout>
              <Navbar cartCount={cartCount} onCartClick={() => setIsCartOpen(true)} />
              <ProductsPage onAddToCart={handleAddToCart} />
              <Footer />
              <CartDrawer
                isOpen={isCartOpen}
                onClose={() => setIsCartOpen(false)}
                items={cartItems}
                onUpdateQuantity={handleUpdateQuantity}
                onRemoveItem={handleRemoveItem}
              />
            </Layout>
          }
        />
        <Route
          path="/product/:id"
          element={
            <Layout>
              <Navbar cartCount={cartCount} onCartClick={() => setIsCartOpen(true)} />
              <ProductDetailPage onAddToCart={handleAddToCart} />
              <Footer />
              <CartDrawer
                isOpen={isCartOpen}
                onClose={() => setIsCartOpen(false)}
                items={cartItems}
                onUpdateQuantity={handleUpdateQuantity}
                onRemoveItem={handleRemoveItem}
              />
            </Layout>
          }
        />
        <Route
          path="/about"
          element={
            <Layout>
              <Navbar cartCount={cartCount} onCartClick={() => setIsCartOpen(true)} />
              <AboutPage />
              <Footer />
              <CartDrawer
                isOpen={isCartOpen}
                onClose={() => setIsCartOpen(false)}
                items={cartItems}
                onUpdateQuantity={handleUpdateQuantity}
                onRemoveItem={handleRemoveItem}
              />
            </Layout>
          }
        />
        <Route
          path="/contact"
          element={
            <Layout>
              <Navbar cartCount={cartCount} onCartClick={() => setIsCartOpen(true)} />
              <ContactPage />
              <Footer />
              <CartDrawer
                isOpen={isCartOpen}
                onClose={() => setIsCartOpen(false)}
                items={cartItems}
                onUpdateQuantity={handleUpdateQuantity}
                onRemoveItem={handleRemoveItem}
              />
            </Layout>
          }
        />
        <Route
          path="/cart"
          element={
            <Layout>
              <Navbar cartCount={cartCount} onCartClick={() => setIsCartOpen(true)} />
              <CartPage items={cartItems} onUpdateQuantity={handleUpdateQuantity} onRemoveItem={handleRemoveItem} />
              <Footer />
              <CartDrawer
                isOpen={isCartOpen}
                onClose={() => setIsCartOpen(false)}
                items={cartItems}
                onUpdateQuantity={handleUpdateQuantity}
                onRemoveItem={handleRemoveItem}
              />
            </Layout>
          }
        />
        <Route
          path="/checkout"
          element={
            <Layout>
              <Navbar cartCount={cartCount} onCartClick={() => setIsCartOpen(true)} />
              <CheckoutPage items={cartItems} />
              <Footer />
              <CartDrawer
                isOpen={isCartOpen}
                onClose={() => setIsCartOpen(false)}
                items={cartItems}
                onUpdateQuantity={handleUpdateQuantity}
                onRemoveItem={handleRemoveItem}
              />
            </Layout>
          }
        />
        <Route
          path="/profile"
          element={
            <Layout>
              <Navbar cartCount={cartCount} onCartClick={() => setIsCartOpen(true)} />
              <ProfilePage />
              <Footer />
              <CartDrawer
                isOpen={isCartOpen}
                onClose={() => setIsCartOpen(false)}
                items={cartItems}
                onUpdateQuantity={handleUpdateQuantity}
                onRemoveItem={handleRemoveItem}
              />
            </Layout>
          }
        />
        <Route
          path="/subscription"
          element={
            <Layout>
              <Navbar cartCount={cartCount} onCartClick={() => setIsCartOpen(true)} />
              <SubscriptionPage />
              <Footer />
              <CartDrawer
                isOpen={isCartOpen}
                onClose={() => setIsCartOpen(false)}
                items={cartItems}
                onUpdateQuantity={handleUpdateQuantity}
                onRemoveItem={handleRemoveItem}
              />
            </Layout>
          }
        />
        <Route
          path="*"
          element={
            <Layout>
              <Navbar cartCount={cartCount} onCartClick={() => setIsCartOpen(true)} />
              <NotFoundPage />
              <Footer />
              <CartDrawer
                isOpen={isCartOpen}
                onClose={() => setIsCartOpen(false)}
                items={cartItems}
                onUpdateQuantity={handleUpdateQuantity}
                onRemoveItem={handleRemoveItem}
              />
            </Layout>
          }
        />
      </Routes>
    </>
  );
}
