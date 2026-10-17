'use client';

// =============================================================================
// COMPOSANT ACCORDÉON SECTIONS TARIFS PAR CATÉGORIE (THÈME CLAIR)
// =============================================================================

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, Clock, ShoppingBag } from 'lucide-react';
import { pickServiceIcon } from '@/components/icons/service-icons';
import { normalizeCatalogName } from '@/lib/catalog';

interface ServiceItem {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number | string;
  estimated_days?: number | null;
}

interface CategoryAccordionsProps {
  slug: string;
  servicesByCategory: Record<string, ServiceItem[]>;
}

export function CategoryAccordions({ slug, servicesByCategory }: CategoryAccordionsProps) {
  const categories = Object.keys(servicesByCategory);

  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    if (categories.length > 0) {
      initial[categories[0]] = true;
    }
    return initial;
  });

  // Gestion du scroll et de l'ouverture automatique si ancre présente dans l'URL (#cat-...)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const hash = window.location.hash.replace('#cat-', '');
      const matchedCat = categories.find(
        (c) =>
          normalizeCatalogName(c) === normalizeCatalogName(hash) ||
          c.toLowerCase().replace(/\s+/g, '-') === hash.toLowerCase()
      );

      if (matchedCat) {
        setOpenCategories({ [matchedCat]: true });
        const el = document.getElementById(`cat-${matchedCat.toLowerCase().replace(/\s+/g, '-')}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
  }, [categories]);

  const toggleCategory = (catName: string) => {
    setOpenCategories((prev) => ({
      ...prev,
      [catName]: !prev[catName],
    }));
  };

  if (categories.length === 0) {
    return (
      <div className="p-6 text-center text-slate-500 bg-white rounded-2xl border border-slate-200 text-sm">
        Aucun tarif n'est disponible pour le moment.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {categories.map((catName) => {
        const items = servicesByCategory[catName];
        const isOpen = !!openCategories[catName];
        const anchorId = `cat-${normalizeCatalogName(catName)}`;

        return (
          <div
            key={catName}
            id={anchorId}
            className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden transition scroll-mt-20"
          >
            {/* En-tête repliable */}
            <button
              type="button"
              onClick={() => toggleCategory(catName)}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-50 transition min-h-[48px]"
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-xl bg-[#F7F9FC] text-[#041C4C] flex items-center justify-center shrink-0 border border-slate-200">
                  {pickServiceIcon(catName, 'w-4 h-4')}
                </div>
                <h3 className="font-bold text-[#041C4C] text-sm md:text-base">
                  {catName}
                </h3>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  {items.length}
                </span>
                <div className="text-slate-400">
                  {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </div>
              </div>
            </button>

            {/* Contenu de la catégorie */}
            {isOpen && (
              <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {items.map((service) => (
                    <div
                      key={service.id}
                      className="p-3 rounded-xl bg-[#F7F9FC] border border-slate-200/60 hover:border-amber-400/50 transition flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-bold text-[#041C4C] text-xs md:text-sm">
                            {service.name}
                          </h4>
                          <span className="text-xs font-mono font-black text-[#041C4C] bg-[#FFC72C] px-2 py-0.5 rounded-md shrink-0 shadow-2xs">
                            {Number(service.price).toLocaleString('fr-FR')} FCFA
                          </span>
                        </div>
                        {service.description && (
                          <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                            {service.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-200/60 text-[11px] text-slate-500">
                        <span className="flex items-center font-medium">
                          <Clock className="w-3 h-3 mr-1 text-slate-400" />
                          ~{service.estimated_days || 2}j
                        </span>

                        <Link
                          href={`/${slug}/commander`}
                          className="font-bold text-[#0B5CE1] hover:underline text-[11px] flex items-center"
                        >
                          Commander
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-1 flex justify-end">
                  <Link
                    href={`/${slug}/commander`}
                    className="px-4 py-2 bg-[#FFC72C] hover:bg-[#F5A300] text-[#041C4C] font-extrabold text-xs rounded-xl shadow-xs flex items-center transition active:scale-95"
                  >
                    <ShoppingBag className="w-3.5 h-3.5 mr-1.5" />
                    Commander dans cette catégorie
                  </Link>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
