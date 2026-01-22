# 🍎 The Fruit Tribe

A modern, responsive e-commerce platform for fresh, organic fruits delivered straight to your doorstep. Built with React, TypeScript, and Tailwind CSS.

## 🌟 Features

- **🛒 Shopping Cart**: Full-featured cart with add/remove/update functionality
- **👤 User Authentication**: Login, signup, and profile management
- **📱 Responsive Design**: Optimized for all devices (mobile, tablet, desktop)
- **🎨 Beautiful UI**: Modern design with smooth animations and transitions
- **🔍 Product Catalog**: Browse and search through a variety of fresh fruits
- **💳 Checkout Process**: Secure and streamlined checkout experience
- **📦 Order Management**: Track orders and view order history
- **🔄 Subscription Service**: Subscribe to regular fruit deliveries
- **⭐ Reviews & Ratings**: Customer feedback system
- **🎯 Special Offers**: Promotional banners and discount codes

## 🛠️ Technology Stack

- **Frontend**: React 18.3.1 with TypeScript
- **Routing**: React Router DOM v7
- **Styling**: Tailwind CSS v4
- **Animations**: Framer Motion
- **UI Components**: Radix UI + Lucide Icons
- **Build Tool**: Vite
- **State Management**: React Context API
- **Forms**: React Hook Form

## 🚀 Quick Start

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/the-fruit-tribe.git
   cd the-fruit-tribe
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173`

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## 📁 Project Structure

```
the-fruit-tribe/
├── public/                 # Static assets
├── src/
│   ├── app/               # Main application components
│   │   ├── components/    # Reusable UI components
│   │   ├── context/       # React contexts
│   │   ├── pages/         # Page components
│   │   └── ErrorBoundary.tsx
│   ├── assets/            # Images, logos, etc.
│   ├── styles/            # CSS and styling files
│   ├── main.tsx          # Application entry point
│   └── app.tsx           # Main app component
├── dist/                 # Production build output
├── package.json
├── vite.config.ts
└── README.md
```

## 🎨 Key Components

### Pages
- **Home Page**: Hero section, featured products, testimonials
- **Products**: Product catalog with filtering and search
- **Product Detail**: Individual product information
- **Cart**: Shopping cart management
- **Checkout**: Multi-step checkout process
- **Profile**: User account management
- **Authentication**: Login and signup forms

### Components
- **Navbar**: Responsive navigation with cart indicator
- **Footer**: Comprehensive footer with links and info
- **ProductCard**: Reusable product display component
- **CartDrawer**: Slide-out cart interface
- **Hero**: Landing page hero section

## 🌐 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## 📱 Responsive Breakpoints

- **Mobile**: < 768px
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
VITE_API_URL=https://your-api-url.com
VITE_APP_NAME=The Fruit Tribe
```

### Tailwind CSS Configuration

The project uses Tailwind CSS v4 with custom configuration in `vite.config.ts`.

## 🚀 Deployment

### Build for Production

```bash
npm run build
```

The build output will be in the `dist/` directory.

### Deploy to Vercel

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Vercel will automatically build and deploy

### Deploy to Netlify

1. Run `npm run build`
2. Upload the `dist/` folder to Netlify
3. Configure your custom domain if needed

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Unsplash](https://unsplash.com/) for beautiful fruit images
- [Tailwind CSS](https://tailwindcss.com/) for the utility-first CSS framework
- [Framer Motion](https://www.framer.com/motion/) for smooth animations
- [Radix UI](https://www.radix-ui.com/) for accessible UI components

## 📞 Support

For support, please email `hello@fruittribe.com` or create an issue in the GitHub repository.

---

**Built with ❤️ by The Fruit Tribe Team**
