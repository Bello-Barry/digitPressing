'use client';

import React, { useState } from 'react';
import { Shirt, Plus, Edit2, CheckCircle2, XCircle, Search, Clock, AlertTriangle, Tag, Layers, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  createServiceAction,
  updateServiceAction,
  toggleServiceStatusAction,
  createCategoryAction,
  createGarmentTypeAction,
  type ServiceCategory,
  type GarmentType,
} from '@/actions/services';
import { TREATMENT_LABELS, type TreatmentType, formatServiceName } from '@/lib/catalog';

interface Service {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  category_id: string | null;
  garment_type_id: string | null;
  treatment: TreatmentType | string | null;
  needs_review: boolean;
  price: number;
  cost_price: number | null;
  estimated_days: number;
  is_active: boolean;
  created_at: string;
}

interface ServiceCatalogClientProps {
  initialServices: Service[];
  initialCategories: ServiceCategory[];
  initialGarmentTypes: GarmentType[];
  canManageServices: boolean;
  canViewCosts?: boolean;
  userRole: string;
  errorMessage?: string | null;
}

export function ServiceCatalogClient({
  initialServices,
  initialCategories,
  initialGarmentTypes,
  canManageServices,
  canViewCosts = false,
  userRole,
  errorMessage,
}: ServiceCatalogClientProps) {
  const [services, setServices] = useState<Service[]>(initialServices);
  const [categories, setCategories] = useState<ServiceCategory[]>(initialCategories);
  const [garmentTypes, setGarmentTypes] = useState<GarmentType[]>(initialGarmentTypes);

  const [search, setSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');

  // Modal states pour la prestation
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(false);

  // Form states pour la prestation
  const [categoryId, setCategoryId] = useState<string>(
    categories.length > 0 ? categories[0].id : ''
  );
  const [garmentTypeId, setGarmentTypeId] = useState<string>('');
  const [treatment, setTreatment] = useState<TreatmentType>('WASH_IRON');
  const [price, setPrice] = useState<number | ''>('');
  const [costPrice, setCostPrice] = useState<number | ''>('');
  const [estimatedDays, setEstimatedDays] = useState<number>(2);
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Sub-modals pour la création de catégorie / article
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);

  const [isAddGarmentOpen, setIsAddGarmentOpen] = useState(false);
  const [newGarmentName, setNewGarmentName] = useState('');
  const [creatingGarment, setCreatingGarment] = useState(false);

  // Obtenir les articles filtrés selon la catégorie sélectionnée dans le formulaire
  const filteredGarmentTypesInForm = garmentTypes.filter(
    gt => !categoryId || gt.category_id === categoryId
  );

  const openCreateModal = () => {
    setEditingService(null);
    const defaultCat = categories.length > 0 ? categories[0].id : '';
    setCategoryId(defaultCat);
    const availableGarments = garmentTypes.filter(gt => !defaultCat || gt.category_id === defaultCat);
    setGarmentTypeId(availableGarments.length > 0 ? availableGarments[0].id : '');
    setTreatment('WASH_IRON');
    setPrice('');
    setCostPrice('');
    setEstimatedDays(2);
    setDescription('');
    setIsActive(true);
    setIsModalOpen(true);
  };

  const openEditModal = (service: Service) => {
    setEditingService(service);
    const catId = service.category_id || (categories.length > 0 ? categories[0].id : '');
    setCategoryId(catId);
    setGarmentTypeId(service.garment_type_id || '');
    setTreatment((service.treatment as TreatmentType) || 'WASH_IRON');
    setPrice(service.price);
    setCostPrice(service.cost_price ?? '');
    setEstimatedDays(service.estimated_days || 2);
    setDescription(service.description || '');
    setIsActive(service.is_active);
    setIsModalOpen(true);
  };

  const handleCategoryChangeInForm = (newCatId: string) => {
    setCategoryId(newCatId);
    const available = garmentTypes.filter(gt => gt.category_id === newCatId);
    if (available.length > 0) {
      setGarmentTypeId(available[0].id);
    } else {
      setGarmentTypeId('');
    }
  };

  const handleAddCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    setCreatingCategory(true);
    try {
      const res = await createCategoryAction(newCategoryName);
      if (!res.success) {
        if (res.duplicate && res.category) {
          toast.error(res.error || 'Cette catégorie existe déjà.');
          setCategoryId(res.category.id);
          setIsAddCategoryOpen(false);
          setNewCategoryName('');
        } else {
          toast.error(res.error || 'Erreur lors de la création de la catégorie.');
        }
      } else if (res.category) {
        toast.success(`Catégorie "${res.category.name}" ajoutée.`);
        setCategories(prev => [...prev, res.category!]);
        setCategoryId(res.category.id);
        setIsAddCategoryOpen(false);
        setNewCategoryName('');
      }
    } catch {
      toast.error('Erreur inattendue.');
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleAddGarmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGarmentName.trim() || !categoryId) {
      toast.error('Veuillez d\'abord sélectionner une catégorie.');
      return;
    }

    setCreatingGarment(true);
    try {
      const res = await createGarmentTypeAction(categoryId, newGarmentName);
      if (!res.success) {
        if (res.duplicate && res.garmentType) {
          toast.error(res.error || 'Cet article existe déjà.');
          setGarmentTypeId(res.garmentType.id);
          setIsAddGarmentOpen(false);
          setNewGarmentName('');
        } else {
          toast.error(res.error || 'Erreur lors de la création de l\'article.');
        }
      } else if (res.garmentType) {
        toast.success(`Article "${res.garmentType.name}" ajouté.`);
        setGarmentTypes(prev => [...prev, res.garmentType!]);
        setGarmentTypeId(res.garmentType.id);
        setIsAddGarmentOpen(false);
        setNewGarmentName('');
      }
    } catch {
      toast.error('Erreur inattendue.');
    } finally {
      setCreatingGarment(false);
    }
  };

  const handleSubmitService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageServices) {
      toast.error('Permission refusée.');
      return;
    }

    if (price === '' || Number(price) < 0) {
      toast.error('Veuillez saisir un tarif valide.');
      return;
    }

    setLoading(true);

    try {
      const selectedGarment = garmentTypes.find(gt => gt.id === garmentTypeId);
      const selectedCat = categories.find(c => c.id === categoryId);

      if (editingService) {
        const res = await updateServiceAction(editingService.id, {
          category_id: categoryId || undefined,
          garment_type_id: garmentTypeId || undefined,
          treatment: treatment,
          category: selectedCat?.name,
          name: formatServiceName(selectedGarment?.name, treatment, editingService.name),
          price: Number(price),
          cost_price: canViewCosts && costPrice !== '' ? Number(costPrice) : undefined,
          estimated_days: Number(estimatedDays),
          description: description,
          is_active: isActive,
          needs_review: false,
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
        const res = await createServiceAction({
          category_id: categoryId || undefined,
          garment_type_id: garmentTypeId || undefined,
          treatment: treatment,
          category: selectedCat?.name,
          name: formatServiceName(selectedGarment?.name, treatment),
          price: Number(price),
          cost_price: canViewCosts && costPrice !== '' ? Number(costPrice) : undefined,
          estimated_days: Number(estimatedDays),
          description: description,
          is_active: isActive,
          needs_review: false,
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
    } catch {
      toast.error('Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (service: Service) => {
    if (!canManageServices) {
      toast.error('Permission refusée.');
      return;
    }

    const newStatus = !service.is_active;
    const res = await toggleServiceStatusAction(service.id, newStatus);
    if (!res.success) {
      toast.error(res.error || 'Impossible de changer le statut.');
    } else {
      toast.success(newStatus ? 'Prestation activée' : 'Prestation désactivée');
      setServices(prev =>
        prev.map(s => (s.id === service.id ? { ...s, is_active: newStatus } : s))
      );
    }
  };

  // Filtrage des prestations dans la vue
  const filteredServices = services.filter(s => {
    const matchesSearch =
      (s.name && s.name.toLowerCase().includes(search.toLowerCase())) ||
      (s.description && s.description.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory =
      selectedCategoryFilter === 'ALL' ||
      s.category_id === selectedCategoryFilter ||
      s.category === selectedCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Alerte d'erreur de chargement si présente */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-red-950/60 border border-red-800 text-red-200 text-xs flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <div className="flex-1">
            <span className="font-bold block">Un problème est survenu lors du chargement :</span>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center">
            <Shirt className="w-6 h-6 mr-2 text-amber-400" />
            Catalogue des Prestations ({filteredServices.length})
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gérez la grille tarifaire normalisée. Les articles et catégories sont choisis dans des listes standardisées.
          </p>
        </div>

        {canManageServices && (
          <button
            onClick={openCreateModal}
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs tracking-wide transition shadow-lg shadow-amber-500/10 active:scale-95 min-h-[44px]"
          >
            <Plus className="w-4 h-4 mr-1.5 stroke-[2.5]" />
            Ajouter une prestation
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
            className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition min-h-[44px]"
          />
        </div>

        <select
          value={selectedCategoryFilter}
          onChange={e => setSelectedCategoryFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 text-xs text-white rounded-xl px-3 py-2.5 focus:outline-none focus:border-amber-500 transition min-h-[44px]"
        >
          <option value="ALL">Toutes les catégories</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Services Grid */}
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
                    <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                      <h3 className="font-bold text-white text-sm truncate">{s.name || 'Prestation sans nom'}</h3>
                      {s.needs_review && canManageServices && (
                        <span className="inline-flex items-center text-[10px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-full whitespace-nowrap">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          À normaliser
                        </span>
                      )}
                    </div>
                    <span className="inline-block mt-1 text-[10px] font-medium text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                      {s.category || 'Vêtements'}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
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
                  {canViewCosts && s.cost_price != null && (
                    <span className="text-[10px] text-slate-500 font-mono" title="Coût de revient">
                      Coût: {Number(s.cost_price).toLocaleString('fr-FR')} FCFA
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-1.5">
                  {canManageServices ? (
                    <>
                      <button
                        onClick={() => handleToggleActive(s)}
                        title={s.is_active ? 'Désactiver le service' : 'Activer le service'}
                        className={`p-2 rounded-lg text-xs transition min-h-[36px] min-w-[36px] flex items-center justify-center ${
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
                        className="p-2 rounded-lg text-slate-300 bg-slate-800 hover:bg-slate-700 transition min-h-[36px] min-w-[36px] flex items-center justify-center"
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

      {/* Modal d'ajout / modification de prestation */}
      {isModalOpen && canManageServices && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center">
                <Shirt className="w-4 h-4 mr-2 text-amber-400" />
                {editingService ? 'Modifier la prestation' : 'Ajouter une prestation'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm p-2 min-h-[44px] min-w-[44px]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitService} className="space-y-4 text-xs">
              {/* Catégorie */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-medium flex items-center">
                    <Layers className="w-3.5 h-3.5 mr-1 text-amber-400" />
                    Catégorie *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddCategoryOpen(true)}
                    className="text-amber-400 hover:text-amber-300 font-bold text-[11px] flex items-center"
                  >
                    <Plus className="w-3 h-3 mr-0.5" /> Ajouter une catégorie
                  </button>
                </div>
                <select
                  value={categoryId}
                  onChange={e => handleCategoryChangeInForm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-amber-500 min-h-[44px]"
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Article (garment_type) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-medium flex items-center">
                    <Tag className="w-3.5 h-3.5 mr-1 text-amber-400" />
                    Article / Vêtement *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddGarmentOpen(true)}
                    className="text-amber-400 hover:text-amber-300 font-bold text-[11px] flex items-center"
                  >
                    <Plus className="w-3 h-3 mr-0.5" /> Ajouter un article
                  </button>
                </div>
                <select
                  value={garmentTypeId}
                  onChange={e => setGarmentTypeId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-amber-500 min-h-[44px]"
                >
                  {filteredGarmentTypesInForm.length === 0 ? (
                    <option value="">Sélectionner ou ajouter un article</option>
                  ) : (
                    filteredGarmentTypesInForm.map(gt => (
                      <option key={gt.id} value={gt.id}>
                        {gt.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Traitement */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">Traitement *</label>
                <select
                  value={treatment}
                  onChange={e => setTreatment(e.target.value as TreatmentType)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-amber-500 min-h-[44px]"
                >
                  {Object.entries(TREATMENT_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Nom généré aperçu */}
              <div className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-xl">
                <span className="text-[10px] text-slate-400 block font-medium">Nom affiché généré :</span>
                <span className="text-xs font-bold text-amber-300">
                  {formatServiceName(
                    garmentTypes.find(gt => gt.id === garmentTypeId)?.name,
                    treatment,
                    editingService?.name
                  )}
                </span>
              </div>

              {/* Prix et Coût */}
              <div className={`grid ${canViewCosts ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
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
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-amber-400 font-mono font-bold focus:outline-none focus:border-amber-500 min-h-[44px]"
                  />
                </div>

                {canViewCosts && (
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
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-300 font-mono focus:outline-none focus:border-amber-500 min-h-[44px]"
                    />
                  </div>
                )}
              </div>

              {/* Délai estimé */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">Délai estimé (jours)</label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={estimatedDays}
                  onChange={e => setEstimatedDays(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-amber-500 min-h-[44px]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Détails complémentaires..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              {/* Statut */}
              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center space-x-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={e => setIsActive(e.target.checked)}
                    className="rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-slate-950 w-4 h-4"
                  />
                  <span>Prestation active et disponible au public</span>
                </label>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold min-h-[44px]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition disabled:opacity-50 min-h-[44px]"
                >
                  {loading ? 'Enregistrement...' : editingService ? 'Mettre à jour' : 'Créer la prestation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sub-modal: Création de catégorie */}
      {isAddCategoryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center">
              <Layers className="w-4 h-4 mr-2 text-amber-400" />
              Nouvelle Catégorie
            </h3>
            <form onSubmit={handleAddCategorySubmit} className="space-y-3">
              <div>
                <label className="block text-slate-300 text-xs mb-1">Nom de la catégorie *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Linge de maison"
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 min-h-[44px]"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddCategoryOpen(false)}
                  className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs min-h-[40px]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creatingCategory}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs min-h-[40px]"
                >
                  {creatingCategory ? 'Ajout...' : 'Créer la catégorie'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sub-modal: Création d'article (garment_type) */}
      {isAddGarmentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center">
              <Tag className="w-4 h-4 mr-2 text-amber-400" />
              Nouveau Vêtement / Article
            </h3>
            <form onSubmit={handleAddGarmentSubmit} className="space-y-3">
              <div>
                <label className="block text-slate-300 text-xs mb-1">Nom de l'article *</label>
                <input
                  type="text"
                  required
                  placeholder="ex: Serviette, Bazin"
                  value={newGarmentName}
                  onChange={e => setNewGarmentName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 min-h-[44px]"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddGarmentOpen(false)}
                  className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs min-h-[40px]"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={creatingGarment}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs min-h-[40px]"
                >
                  {creatingGarment ? 'Ajout...' : 'Créer l\'article'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
