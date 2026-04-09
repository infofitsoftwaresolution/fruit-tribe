import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { Clock, Users, ArrowRight, Zap, X } from 'lucide-react';
import { useStore } from '@/app/context/StoreContext';
import { cn } from '@/lib/utils';

export function RecipesSection() {
  const { theme, isEditing, updateTheme } = useStore();
  const [activeRecipeIndex, setActiveRecipeIndex] = useState<number | null>(null);

  const handleTextChange = (field: string) => (e: React.FocusEvent<HTMLElement>) => {
    if (!isEditing) return;
    const newText = e.currentTarget.innerText;
    updateTheme({ [field]: newText });
  };

  const recipesData = [
    {
      title: 'Tropical Mango Smoothie',
      image: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800',
      execution: '10 mins',
      yield: '2 servings',
      description: 'A refreshing blend of mango, banana, coconut and granola.',
      ingredients: ['Mango', 'Banana', 'Coconut milk', 'Granola'],
      color: 'emerald',
    },
    {
      title: 'Berry Blast Parfait',
      image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800',
      execution: '15 mins',
      yield: '4 servings',
      description: 'Layers of fresh berries, yogurt and honey.',
      ingredients: ['Strawberries', 'Blueberries', 'Yogurt', 'Honey'],
      color: 'amber',
    },
    {
      title: 'Fresh Fruit Salad',
      image: 'https://images.unsplash.com/photo-1603046891726-36bfd957e243?w=800',
      execution: '20 mins',
      yield: '6 servings',
      description: 'A mix of seasonal fruit with mint and lime.',
      ingredients: ['Mixed fruit', 'Mint', 'Lime', 'Honey'],
      color: 'blue',
    },
  ];
  const activeRecipe = activeRecipeIndex === null ? null : recipesData[activeRecipeIndex] ?? null;

  const buttonHoverClasses: Record<string, string> = {
    emerald: 'group-hover:bg-emerald-500',
    amber: 'group-hover:bg-amber-500',
    blue: 'group-hover:bg-blue-500',
  };

  const RECIPE_PLACEHOLDER =
    'https://images.unsplash.com/photo-1547514701-42782101795e?q=80&w=800&auto=format&fit=crop';

  function RecipeImage({ src, alt }: { src: string; alt: string }) {
    const [effectiveSrc, setEffectiveSrc] = useState(
      () => (src && src.trim()) ? src : RECIPE_PLACEHOLDER,
    );
    const handleError = () => {
      setEffectiveSrc(RECIPE_PLACEHOLDER);
    };
    return (
      <motion.img
        src={effectiveSrc}
        alt={alt}
        onError={handleError}
        loading="lazy"
        className="w-full h-full object-cover transition-transform duration-[2s] group-hover:scale-110"
      />
    );
  }

  useEffect(() => {
    if (!activeRecipe) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveRecipeIndex(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [activeRecipe]);

  return (
    <section className="relative py-32 bg-white overflow-hidden">
      {/* Background Architectural Elements */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-0 right-0 h-[600px] w-[600px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-12">
        {/* Section Header Orchestration */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-12 mb-24">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl space-y-6"
          >
            <div className="flex items-center gap-3">
              <div className="h-[1px] w-12 bg-emerald-500" />
              <span className="text-xs font-semibold text-emerald-600 tracking-wide">Fresh recipe ideas</span>
            </div>

            <h2 className="text-5xl md:text-8xl font-black text-slate-900 tracking-tighter uppercase leading-none">
              <span
                contentEditable={isEditing}
                suppressContentEditableWarning
                onBlur={handleTextChange('recipesSectionTitle')}
                className="outline-none"
              >
                {theme.recipesSectionTitle || 'Recipes'}
              </span>
            </h2>

            <p
              contentEditable={isEditing}
              suppressContentEditableWarning
              onBlur={handleTextChange('recipesSectionSubtitle')}
              className="text-lg md:text-xl text-slate-500 font-medium tracking-tight leading-relaxed outline-none"
            >
              {theme.recipesSectionSubtitle || 'Simple, delicious ways to use your fresh produce.'}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <button className="h-16 px-12 bg-slate-900 text-white rounded-[1.75rem] text-sm font-semibold flex items-center gap-4 hover:bg-emerald-500 transition-all shadow-3xl active:scale-95 group">
              View all recipes
              <ArrowRight className="h-4 w-4 group-hover:translate-x-2 transition-transform" />
            </button>
          </motion.div>
        </div>

        {/* Integration Registry Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {recipesData.map((recipe, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group relative bg-white rounded-[3rem] overflow-hidden border border-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.02)] hover:shadow-3xl hover:border-emerald-500 transition-all duration-700 flex flex-col h-full"
            >
              <div className="relative h-72 overflow-hidden shrink-0">
                <RecipeImage src={recipe.image} alt={recipe.title} />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                {/* Recipe info */}
                <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all duration-500">
                  <div className="flex gap-2">
                    <div className="px-3 py-1.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center gap-2">
                      <Clock className="h-3 w-3 text-white" />
                      <span className="text-xs font-semibold text-white">{recipe.execution}</span>
                    </div>
                    <div className="px-3 py-1.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center gap-2">
                      <Users className="h-3 w-3 text-white" />
                      <span className="text-xs font-semibold text-white">{recipe.yield}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-10 flex flex-col flex-1 space-y-8">
                <div className="space-y-4">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-tight group-hover:text-emerald-600 transition-colors">
                    {recipe.title}
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed line-clamp-2">
                    {recipe.description}
                  </p>
                </div>

                <div className="space-y-4">
                  <span className="text-xs font-semibold text-slate-500 tracking-wide">Ingredients</span>
                  <div className="flex flex-wrap gap-2">
                    {recipe.ingredients.map((ing, i) => (
                      <span key={i} className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg text-xs font-medium text-slate-600 group-hover:text-slate-900 group-hover:border-emerald-100 transition-all">
                        {ing}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-8 mt-auto border-t border-slate-50 flex items-center justify-between">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      "h-12 w-full flex items-center justify-center gap-3 text-sm font-semibold transition-all shadow-xl",
                      "bg-slate-900 text-white rounded-2xl",
                      buttonHoverClasses[recipe.color] || 'group-hover:bg-emerald-500'
                    )}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setActiveRecipeIndex(index);
                    }}
                  >
                    View recipe
                    <Zap className="h-3 w-3 group-hover:scale-125 transition-transform" />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        {activeRecipe && typeof document !== 'undefined' && createPortal(
            <div
              className="fixed inset-0 z-[1000] bg-slate-900/55 backdrop-blur-md overflow-y-auto p-4 md:p-8 flex items-center justify-center"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setActiveRecipeIndex(null);
                }
              }}
            >
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="relative bg-white rounded-[2rem] max-w-2xl w-full border border-slate-100 shadow-2xl max-h-[90vh] overflow-y-auto"
              >
                <div className="relative h-64 overflow-hidden">
                  <RecipeImage src={activeRecipe.image} alt={activeRecipe.title} />
                  <button
                    onClick={() => setActiveRecipeIndex(null)}
                    className="absolute top-4 right-4 h-9 w-9 rounded-2xl bg-white/90 text-slate-500 hover:text-red-500 shadow-md flex items-center justify-center"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="p-8 space-y-6">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-emerald-500 tracking-wide">
                      Recipe
                    </p>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                      {activeRecipe.title}
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {activeRecipe.description}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm text-slate-600 font-medium">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-emerald-500" />
                      <span>Prep time: {activeRecipe.execution}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-emerald-500" />
                      <span>Serves: {activeRecipe.yield}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500 tracking-wide">
                      Ingredients
                    </p>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
                      {activeRecipe.ingredients.map((ing, i) => (
                        <li key={i}>{ing}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500 tracking-wide">
                      Simple method
                    </p>
                    <ol className="list-decimal pl-5 space-y-1 text-sm text-slate-700">
                      <li>Prepare all ingredients as listed above.</li>
                      <li>Combine fruits in a large bowl.</li>
                      <li>Add any herbs, yogurt or honey as desired.</li>
                      <li>Toss gently and serve chilled.</li>
                    </ol>
                  </div>
                </div>
              </motion.div>
            </div>,
            document.body
          )}
      </div>
    </section>
  );
}
