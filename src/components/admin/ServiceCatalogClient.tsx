'use client';

import React, { useState } from 'react';
import { Shirt, Plus, Edit2, CheckCircle2, XCircle, Search, Clock, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { createServiceAction, updateServiceAction, toggleServiceStatusAction } from '@/actions/services';

interface Service {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number;
  cost_price: number | null;
  estimated_days: number;
  is_active: boolean;
  created_at: string;
}

interface ServiceCatalogClientProps {
  initialServices: Service[];
  isManagement: boolean; // true if OWNER, MANAGER or PlatformAdmin
  userRole: string;
}

export function ServiceCatalogClient({ initialServices, isManagement, userRole }: ServiceCatalogClientProps) {
  const [services, setServices] = useState<Service[]>(initialServices);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Vêtement');
  const [price, setPrice] = useState<number | ''>('');
  const [costPrice, setCostPrice] = useState<number | ''>('');
  const [estimatedDays, setEstimatedDays] = useState<number>(2);
  const [isActive, setIsActive] = useState(true);

  // Categories list
  const categories = Array.from(new Set(services.map(s => s.category || 'Vêtement')));

  const openCreateModal = () => {
    setEditingService(null);
    setName('');
    setDescription('');
    setCategory('Vêtement');
    setPrice('');
    setCostPrice('');
    setEstimatedDays(2);
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (service: Service) => {
    setEditingService(service);
    setName(service.name);
    setDescription(service.description || '');
    setCategory(service.category || 'Vêtement');
    setPrice(service.price);
    setCostPrice(service.cost_price ?? '');
    setEstimatedDays(service.estimated_days || 2);
    setIsActive(service.is_active);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isManagement) {
      toast.error('Permission refusée. Vous n\'avez pas les droits de modification.');
      return;
    }

    if (!name.trim()) {
      toast.error('Veuillez saisir un nom de service.');
      return;
    }

    if (price === '' || Number(price) < 0) {
      toast.error('Veuillez saisir un tarif valide.');
      return;
    }

    setLoading(true);

    try {
      if (editingService) {
        // Edit existing service
        const res = await updateServiceAction(editingService.id, {
          name,
          description,
          category,
          price: Number(price),
          cost_price: costPrice !== '' ? Number(costPrice) : undefined,
          estimated_days: Number(estimatedDays),
          is_active: isActive,
        });

        if (!res.success) {
          toast.error(res.error || 'Erreur de mise à jour.');
        } else {
          toast.success('Prestation mise à jour avec succès');
          setServices(prev =>
            prev.map(s => (s.id === editingService.id ? (res.service as Service) : s))
          );
          setIsModalOpen(false);
        }
      } else {
        // Create new service
        const res = await createServiceAction({
          name,
          description,
          category,
          price: Number(price),
          cost_price: costPrice !== '' ? Number(costPrice) : undefined,
          estimated_days: Number(estimatedDays),
          is_active: isActive,
        });

        if (!res.success) {
          toast.error(res.error || 'Erreur de création.');
        } else {
          toast.success('Nouvelle prestation ajoutée au catalogue');
          if (res.service) {
            setServices(prev => [res.service as Service, ...prev]);
          }
          setIsModalOpen(false);
        }
      }
    } catch (err) {
      toast.error('Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (service: Service) => {
    if (!isManagement) {
      toast.error('Permission refusée.');
      return;
    }

    const newStatus = !service.is_active;
    const res = await toggleServiceStatusAction(service.id, newStatus);
    if (!res.success) {
      toast.error(res.error || 'Impossible de changer le statut.');
    } else {
      toast.success(newStatus ? 'Prestation activée' : 'Prestation désactivée (masquée du catalogue public)');
      setServices(prev =>
        prev.map(s => (s.id === service.id ? { ...s, is_active: newStatus } : s))
      );
    }
  };

  const filteredServices = services.filter(s => {
    const matchesSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.description && s.description.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = selectedCategory === 'ALL' || s.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center">
            <Shirt className="w-6 h-6 mr-2 text-amber-400" />
            Catalogue des Prestations ({filteredServices.length})
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gérez la grille tarifaire de LB Pressing. Les modifications de prix s'appliquent aux nouvelles commandes sans modifier l'historique.
          </p>
        </div>

        {isManagement && (
          <button
            onClick={openCreateModal}
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs tracking-wide transition shadow-lg shadow-amber-500/10 active:scale-95"
          >
            <Plus className="w-4 h-4 mr-1.5 stroke-[2.5]" />
            Ajouter un service
          </button>
        )}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher une prestation (ex: Chemise, Costume)..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition"
          />
        </div>

        <select
          value={selectedCategory}
          onChange={e => setSelectedCategory(e.target.value)}
          className="bg-slate-900 border border-slate-800 text-xs text-white rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500 transition"
        >
          <option value="ALL">Toutes les catégories</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Services Cards / Mobile List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {filteredServices.length > 0 ? (
          filteredServices.map(s => (
            <div
              key={s.id}
              className={`p-4 rounded-2xl bg-slate-900 border transition flex flex-col justify-between space-y-3 ${
                s.is_active ? 'border-slate-800 hover:border-slate-700' : 'border-red-900/30 bg-slate-950/50 opacity-75'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white text-sm truncate">{s.name}</h3>
                    <span className="inline-block mt-0.5 text-[10px] font-medium text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                      {s.category || 'Vêtement'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-amber-400 text-sm bg-amber-400/10 px-2 py-1 rounded-lg block whitespace-nowrap">
                      {Number(s.price).toLocaleString('fr-FR')} FCFA
                    </span>
                  </div>
                </div>

                {s.description && (
                  <p className="text-xs text-slate-400 mt-2 line-clamp-2">{s.description}</p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center space-x-2">
                  <span className="flex items-center text-[11px] text-slate-400">
                    <Clock className="w-3 h-3 mr-1 text-slate-500" />
                    ~{s.estimated_days || 2}j
                  </span>
                  {isManagement && s.cost_price != null && (
                    <span className="text-[10px] text-slate-500 font-mono" title="Coût de revient">
                      Coût: {Number(s.cost_price).toLocaleString('fr-FR')} FCFA
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-1.5">
                  {isManagement ? (
                    <>
                      <button
                        onClick={() => handleToggleActive(s)}
                        title={s.is_active ? 'Désactiver le service' : 'Activer le service'}
                        className={`p-1.5 rounded-lg text-xs transition ${
                          s.is_active
                            ? 'text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'
                            : 'text-red-400 bg-red-500/10 hover:bg-red-500/20'
                        }`}
                      >
                        {s.is_active ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <XCircle className="w-4 h-4" />
                        )}
                      </button>

                      <button
                        onClick={() => openEditModal(s)}
                        title="Modifier la prestation"
                        className="p-1.5 rounded-lg text-slate-300 bg-slate-800 hover:bg-slate-700 transition"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        s.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                      }`}
                    >
                      {s.is_active ? 'Disponible' : 'Inactif'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full p-8 text-center text-slate-500 text-xs bg-slate-900/50 rounded-2xl border border-slate-800">
            Aucune prestation ne correspond à la recherche.
          </div>
        )}
      </div>

      {/* Edit / Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center">
                <Shirt className="w-4 h-4 mr-2 text-amber-400" />
                {editingService ? 'Modifier la prestation' : 'Ajouter une prestation'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Nom de la prestation *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: Chemise sur cintre, Costume 2 pièces"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Catégorie</label>
                  <input
                    type="text"
                    placeholder="ex: Vêtement, Maison"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Délai estimé (jours)</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={estimatedDays}
                    onChange={e => setEstimatedDays(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Prix de vente (FCFA) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="100"
                    placeholder="ex: 5000"
                    value={price}
                    onChange={e => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-amber-400 font-mono font-bold focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Coût de revient (FCFA)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    placeholder="ex: 1500 (Optionnel)"
                    value={costPrice}
                    onChange={e => setCostPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Détails complémentaires sur le traitement..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={e => setIsActive(e.target.checked)}
                    className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-950"
                  />
                  <span>Prestation active et disponible au public</span>
                </label>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition disabled:opacity-50"
                >
                  {loading ? 'Enregistrement...' : editingService ? 'Mettre à jour' : 'Créer la prestation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
