import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

  const recipes = [
    {
      title: 'Tropical Mango Smoothie',
      image: 'https://images.unsplash.com/photo-1590301157890-4810ed352733?w=800',
      execution: '600s',
      yield: '02 Units',
      description: 'A refreshing blend of mango, banana, coconut and granola.',
      ingredients: ['Mango.v1', 'Banana.Core', 'Coconut.Fluid', 'Granola.Grain'],
      color: 'emerald',
    },
    {
      title: 'Berry Blast Parfait',
      image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800',
      execution: '900s',
      yield: '04 Units',
      description: 'Layers of fresh berries, yogurt and honey.',
      ingredients: ['Strawberries', 'Blueberries', 'Yogurt', 'Honey'],
      color: 'amber',
    },
    {
      title: 'Fresh Fruit Salad Manifest',
      image: 'https://images.unsplash.com/photo-1603046891726-36bfd957e243?w=800',
      execution: '1200s',
      yield: '06 Units',
      description: 'A mix of seasonal fruit with mint and lime.',
      ingredients: ['Mixed fruit', 'Mint', 'Lime', 'Honey'],
      color: 'blue',
    },
  ];

  const colorClasses: Record<string, string> = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    blue: 'bg-blue-500',
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
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.4em]">Culinaric Integration Protocols</span>
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
              className="text-lg md:text-xl text-slate-400 font-bold uppercase tracking-tight italic leading-relaxed outline-none"
            >
              {theme.recipesSectionSubtitle || 'Simple, delicious ways to use your fresh produce.'}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <button className="h-16 px-12 bg-slate-900 text-white rounded-[1.75rem] text-[10px] font-black uppercase tracking-widest flex items-center gap-4 hover:bg-emerald-500 transition-all shadow-3xl active:scale-95 group">
              View all recipes
              <ArrowRight className="h-4 w-4 group-hover:translate-x-2 transition-transform" />
            </button>
          </motion.div>
        </div>

        {/* Integration Registry Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {recipes.map((recipe, index) => (
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
                      <span className="text-[8px] font-black text-white uppercase tracking-widest">{recipe.execution}</span>
                    </div>
                    <div className="px-3 py-1.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center gap-2">
                      <Users className="h-3 w-3 text-white" />
                      <span className="text-[8px] font-black text-white uppercase tracking-widest">{recipe.yield}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-10 flex flex-col flex-1 space-y-8">
                <div className="space-y-4">
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter leading-tight group-hover:text-emerald-600 transition-colors">
                    {recipe.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed italic line-clamp-2">
                    {recipe.description}
                  </p>
                </div>

                <div className="space-y-4">
                  <span className="text-[8px] font-black text-slate-300 uppercase tracking-[0.3em]">Integration Modules</span>
                  <div className="flex flex-wrap gap-2">
                    {recipe.ingredients.map((ing, i) => (
                      <span key={i} className="px-3 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[8px] font-black text-slate-400 uppercase tracking-widest group-hover:text-slate-900 group-hover:border-emerald-100 transition-all">
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
                      "h-12 w-full flex items-center justify-center gap-3 text-[9px] font-black uppercase tracking-widest transition-all shadow-xl",
                      "bg-slate-900 text-white rounded-2xl",
                      `group-hover:${colorClasses[recipe.color] || 'bg-emerald-500'}`
                    )}
                    onClick={() => setActiveRecipeIndex(index)}
                  >
                    Execute Integration
                    <Zap className="h-3 w-3 group-hover:scale-125 transition-transform" />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        <AnimatePresence>
          {activeRecipeIndex !== null && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 40 }}
                className="bg-white rounded-[3rem] max-w-2xl w-full mx-4 overflow-hidden border border-slate-100 shadow-2xl"
              >
                {(() => {
                  const recipe = recipes[activeRecipeIndex];
                  return (
                    <>
                      <div className="relative h-64 overflow-hidden">
                        <RecipeImage src={recipe.image} alt={recipe.title} />
                        <button
                          onClick={() => setActiveRecipeIndex(null)}
                          className="absolute top-4 right-4 h-9 w-9 rounded-2xl bg-white/90 text-slate-500 hover:text-red-500 shadow-md flex items-center justify-center"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="p-8 space-y-6">
                        <div className="space-y-2">
                          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">
                            Recipe
                          </p>
                          <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                            {recipe.title}
                          </h3>
                          <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
                            {recipe.description}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-xs text-slate-600 font-bold uppercase tracking-widest">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-emerald-500" />
                            <span>Prep time: {recipe.execution}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-emerald-500" />
                            <span>Serves: {recipe.yield}</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">
                            Ingredients
                          </p>
                          <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
                            {recipe.ingredients.map((ing, i) => (
                              <li key={i}>{ing}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">
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
                    </>
                  );
                })()}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
