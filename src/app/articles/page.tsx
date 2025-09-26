'use client';

// =============================================================================
// PAGE GESTION DES ARTICLES - Digit PRESSING
// =============================================================================

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Package,
  RefreshCw,
  MoreHorizontal,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Download
  // SUPPRIMÉ: Upload - non utilisé
} from 'lucide-react';
import {
  useArticles,
  useArticleActions,
  useArticleFilters,
  useCurrentArticle,
  useArticleHelpers
} from '@/store/articles';
import { useAuth, useUserPermissions } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { formatCurrency, capitalizeWords } from '@/lib/utils';
import type { Article } from '@/types';

// SUPPRIMÉ LE PRÉFIXE _ POUR CORRIGER L'ERREUR
const CATEGORY_CONFIG = {
  vetement: { label: 'Vêtements', color: 'bg-blue-100 text-blue-800', icon: '👔' },
  chaussure: { label: 'Chaussures', color: 'bg-brown-100 text-brown-800', icon: '👞' },
  accessoire: { label: 'Accessoires', color: 'bg-purple-100 text-purple-800', icon: '👜' },
  maison: { label: 'Maison', color: 'bg-green-100 text-green-800', icon: '🏠' },
  traditionnel: { label: 'Traditionnel', color: 'bg-orange-100 text-orange-800', icon: '👘' },
  delicat: { label: 'Délicat', color: 'bg-pink-100 text-pink-800', icon: '🌸' },
  ceremonie: { label: 'Cérémonie', color: 'bg-yellow-100 text-yellow-800', icon: '💒' },
  enfant: { label: 'Enfant', color: 'bg-cyan-100 text-cyan-800', icon: '👶' },
  uniforme: { label: 'Uniforme', color: 'bg-indigo-100 text-indigo-800', icon: '👮' },
  cuir: { label: 'Cuir', color: 'bg-amber-100 text-amber-800', icon: '🧥' },
  retouche: { label: 'Retouche', color: 'bg-teal-100 text-teal-800', icon: '✂️' },
  special: { label: 'Spécial', color: 'bg-red-100 text-red-800', icon: '⭐' },
};

interface ArticleFormData {
  name: string;
  category: keyof typeof CATEGORY_CONFIG;
  defaultPrice: number;
  description: string;
  estimatedDays: number;
  isActive: boolean;
}

export default function ArticlesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const permissions = useUserPermissions();
  
  // États des stores
  const { articles, articlesByCategory, isLoading, error, pagination } = useArticles();
  const { currentArticle, setCurrentArticle } = useCurrentArticle();
  const { filters, setFilters, resetFilters } = useArticleFilters();
  const { 
    fetchArticles, 
    searchArticles, 
    createArticle, 
    updateArticle, 
    deleteArticle,
    restoreArticle,
    duplicateArticle,
    bulkUpdatePrices,
    bulkToggleStatus,
    clearError 
  } = useArticleActions();
  const { getActiveArticles } = useArticleHelpers();

  // États locaux
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [selectedArticles, setSelectedArticles] = useState<string[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<'price' | 'status'>('price');
  const [bulkPriceUpdate, setBulkPriceUpdate] = useState({ amount: 0, type: 'percentage' as 'amount' | 'percentage' });
  const [bulkStatusUpdate, setBulkStatusUpdate] = useState(true);

  // Formulaire d'édition d'article
  const [formData, setFormData] = useState<ArticleFormData>({
    name: '',
    category: 'vetement',
    defaultPrice: 0,
    description: '',
    estimatedDays: 3,
    isActive: true,
  });

  // Permissions
  const canModifyPrices = permissions.isOwner || permissions.canModifyPrices;

  // Charger les données au montage
  useEffect(() => {
    if (user) {
      fetchArticles({ reset: true });
    }
  }, [user, fetchArticles]);

  // Gestion de la recherche avec debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.trim()) {
        searchArticles(searchTerm);
      } else {
        fetchArticles({ reset: true });
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, searchArticles, fetchArticles]);

  // Gérer les erreurs
  useEffect(() => {
    if (error) {
      setTimeout(clearError, 5000);
    }
  }, [error, clearError]);

  // Expanser toutes les catégories par défaut
  useEffect(() => {
    if (articlesByCategory && expandedCategories.length === 0) {
      setExpandedCategories(Object.keys(articlesByCategory));
    }
  }, [articlesByCategory, expandedCategories.length]);

  // Réinitialiser le formulaire
  const resetForm = () => {
    setFormData({
      name: '',
      category: 'vetement',
      defaultPrice: 0,
      description: '',
      estimatedDays: 3,
      isActive: true,
    });
  };

  // Actions sur les articles - seulement édition
  const handleEditArticle = async () => {
    if (!currentArticle || !canModifyPrices) return;

    try {
      await updateArticle(currentArticle.id, {
        name: capitalizeWords(formData.name.trim()),
        category: formData.category,
        defaultPrice: formData.defaultPrice,
        description: formData.description.trim() || undefined,
        estimatedDays: formData.estimatedDays,
        isActive: formData.isActive,
      });
      
      setShowEditDialog(false);
      setCurrentArticle(null);
      resetForm();
    } catch (error) {
      console.error('Erreur lors de la modification:', error);
    }
  };

  const handleDeleteArticle = async () => {
    if (!currentArticle || !canModifyPrices) return;

    try {
      await deleteArticle(currentArticle.id);
      setShowDeleteDialog(false);
      setCurrentArticle(null);
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
    }
  };

  const handleDuplicateArticle = async (article: Article) => {
    if (!canModifyPrices) return;

    try {
      await duplicateArticle(article.id, `${article.name} (copie)`);
    } catch (error) {
      console.error('Erreur lors de la duplication:', error);
    }
  };

  const handleToggleStatus = async (article: Article) => {
    if (!canModifyPrices) return;

    try {
      await updateArticle(article.id, { isActive: !article.isActive });
    } catch (error) {
      console.error('Erreur lors du changement de statut:', error);
    }
  };

  // Gestion des actions en masse
  const handleBulkAction = async () => {
    if (selectedArticles.length === 0 || !canModifyPrices) return;

    try {
      if (bulkAction === 'price') {
        await bulkUpdatePrices(selectedArticles, bulkPriceUpdate);
      } else {
        await bulkToggleStatus(selectedArticles, bulkStatusUpdate);
      }
      
      setShowBulkDialog(false);
      setSelectedArticles([]);
    } catch (error) {
      console.error('Erreur lors de l\'action en masse:', error);
    }
  };

  // Gestion de la sélection
  const toggleArticleSelection = (articleId: string) => {
    setSelectedArticles(prev => 
      prev.includes(articleId)
        ? prev.filter(id => id !== articleId)
        : [...prev, articleId]
    );
  };

  const selectAllInCategory = (category: string) => {
    const categoryArticles = articlesByCategory[category] || [];
    const categoryIds = categoryArticles.map(a => a.id);
    
    setSelectedArticles(prev => {
      const allSelected = categoryIds.every(id => prev.includes(id));
      if (allSelected) {
        return prev.filter(id => !categoryIds.includes(id));
      } else {
        return [...new Set([...prev, ...categoryIds])];
      }
    });
  };

  // Gestion de l'expansion des catégories
  const toggleCategoryExpansion = (category: string) => {
    setExpandedCategories(prev =>
      prev.includes(category)
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  // Ouvrir les dialogs - seulement édition et suppression
  const openEditDialog = (article: Article) => {
    setCurrentArticle(article);
    setFormData({
      name: article.name,
      category: article.category as keyof typeof CATEGORY_CONFIG,
      defaultPrice: article.defaultPrice,
      description: article.description || '',
      estimatedDays: article.estimatedDays || 3,
      isActive: article.isActive,
    });
    setShowEditDialog(true);
  };

  const openDeleteDialog = (article: Article) => {
    setCurrentArticle(article);
    setShowDeleteDialog(true);
  };

  // Calcul des statistiques
  const activeArticles = getActiveArticles();
  const totalArticles = articles.length;
  const averagePrice = articles.length > 0 
    ? articles.reduce((sum, a) => sum + a.defaultPrice, 0) / articles.length 
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Articles</h1>
          <p className="text-muted-foreground">
            Gestion du catalogue de services de pressing
          </p>
        </div>

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => fetchArticles({ reset: true })}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>

          {canModifyPrices && (
            <Button asChild>
              <Link href="/articles/new">
                <Plus className="h-4 w-4 mr-2" />
                Nouvel article
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <p className="text-red-800">{error}</p>
          </div>
        </Card>
      )}

      {/* Statistiques rapides */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total articles</p>
              <p className="text-2xl font-bold">{totalArticles}</p>
            </div>
            <Package className="h-8 w-8 text-primary" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Actifs</p>
              <p className="text-2xl font-bold text-green-600">{activeArticles.length}</p>
            </div>
            <Eye className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Inactifs</p>
              <p className="text-2xl font-bold text-gray-600">{totalArticles - activeArticles.length}</p>
            </div>
            <EyeOff className="h-8 w-8 text-gray-600" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Prix moyen</p>
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(averagePrice)}
              </p>
            </div>
            <Package className="h-8 w-8 text-primary" />
          </div>
        </Card>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom ou catégorie..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-4 w-4 mr-2" />
          Filtres
        </Button>

        {selectedArticles.length > 0 && canModifyPrices && (
          <Button
            variant="outline"
            onClick={() => setShowBulkDialog(true)}
          >
            Actions ({selectedArticles.length})
          </Button>
        )}

        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Exporter
        </Button>
      </div>

      {/* Filtres */}
      {showFilters && (
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              value={filters.category || 'all'}
              onValueChange={(value) => 
                setFilters({ category: value === 'all' ? undefined : value as keyof typeof CATEGORY_CONFIG })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Catégorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les catégories</SelectItem>
                {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.icon} {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.isActive === undefined ? 'all' : filters.isActive ? 'active' : 'inactive'}
              onValueChange={(value) => 
                setFilters({ 
                  isActive: value === 'all' ? undefined : value === 'active' 
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="active">Actifs</SelectItem>
                <SelectItem value="inactive">Inactifs</SelectItem>
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              onClick={resetFilters}
              className="w-full"
            >
              Réinitialiser
            </Button>
          </div>
        </Card>
      )}

      {/* Liste des articles par catégorie */}
      <div className="space-y-4">
        {isLoading && articles.length === 0 ? (
          <div className="text-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Chargement des articles...</p>
          </div>
        ) : Object.keys(articlesByCategory).length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">Aucun article trouvé</h3>
            <p className="text-muted-foreground mb-4">
              {searchTerm 
                ? "Aucun article ne correspond à votre recherche."
                : "Commencez par créer vos premiers articles."
              }
            </p>
            {canModifyPrices && !searchTerm && (
              <Button asChild>
                <Link href="/articles/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Créer un article
                </Link>
              </Button>
            )}
          </div>
        ) : (
          Object.entries(articlesByCategory).map(([category, categoryArticles]) => {
            const config = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG];
            const isExpanded = expandedCategories.includes(category);
            const categoryIds = categoryArticles.map(a => a.id);
            const allSelected = categoryIds.length > 0 && categoryIds.every(id => selectedArticles.includes(id));
            
            return (
              <Card key={category}>
                <Collapsible 
                  open={isExpanded} 
                  onOpenChange={() => toggleCategoryExpansion(category)}
                >
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5" />
                          ) : (
                            <ChevronRight className="h-5 w-5" />
                          )}
                          <Badge className={config.color}>
                            {config.icon} {config.label}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            ({categoryArticles.length} articles)
                          </span>
                        </div>
                        
                        {canModifyPrices && categoryArticles.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectAllInCategory(category);
                            }}
                          >
                            {allSelected ? 'Désélectionner' : 'Sélectionner'} tout
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <CardContent className="pt-0">
                      <div className="space-y-2">
                        {categoryArticles.map((article) => (
                          <div 
                            key={article.id} 
                            className={`flex items-center gap-4 p-3 border rounded-lg hover:bg-gray-50 ${
                              selectedArticles.includes(article.id) ? 'bg-blue-50 border-blue-200' : ''
                            }`}
                          >
                            {canModifyPrices && (
                              <input
                                type="checkbox"
                                checked={selectedArticles.includes(article.id)}
                                onChange={() => toggleArticleSelection(article.id)}
                                className="rounded"
                              />
                            )}

                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{article.name}</p>
                                {!article.isActive && (
                                  <Badge variant="secondary">Inactif</Badge>
                                )}
                              </div>
                              {article.description && (
                                <p className="text-sm text-muted-foreground">
                                  {article.description}
                                </p>
                              )}
                              <p className="text-sm text-muted-foreground">
                                Délai estimé: {article.estimatedDays || 3} jour{(article.estimatedDays || 3) > 1 ? 's' : ''}
                              </p>
                            </div>

                            <div className="text-right">
                              <p className="text-lg font-bold text-primary">
                                {formatCurrency(article.defaultPrice)}
                              </p>
                            </div>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {canModifyPrices && (
                                  <>
                                    <DropdownMenuItem onClick={() => openEditDialog(article)}>
                                      <Edit className="h-4 w-4 mr-2" />
                                      Modifier
                                    </DropdownMenuItem>
                                    
                                    <DropdownMenuItem onClick={() => handleDuplicateArticle(article)}>
                                      <Copy className="h-4 w-4 mr-2" />
                                      Dupliquer
                                    </DropdownMenuItem>

                                    <DropdownMenuItem onClick={() => handleToggleStatus(article)}>
                                      {article.isActive ? (
                                        <>
                                          <EyeOff className="h-4 w-4 mr-2" />
                                          Désactiver
                                        </>
                                      ) : (
                                        <>
                                          <Eye className="h-4 w-4 mr-2" />
                                          Activer
                                        </>
                                      )}
                                    </DropdownMenuItem>

                                    <DropdownMenuSeparator />
                                    
                                    <DropdownMenuItem 
                                      onClick={() => openDeleteDialog(article)}
                                      className="text-red-600"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Supprimer
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })
        )}
      </div>

      {/* Dialog de modification seulement */}
      <Dialog open={showEditDialog} onOpenChange={(open) => {
        if (!open) {
          setShowEditDialog(false);
          setCurrentArticle(null);
          resetForm();
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier l'article</DialogTitle>
            <DialogDescription>
              Modifier les informations de l'article
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Nom de l'article *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Chemise homme"
              />
            </div>

            <div>
              <Label htmlFor="category">Catégorie *</Label>
              <Select
                value={formData.category}
                onValueChange={(value: keyof typeof CATEGORY_CONFIG) => 
                  setFormData(prev => ({ ...prev, category: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.icon} {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price">Prix (FCFA) *</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.defaultPrice}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    defaultPrice: parseFloat(e.target.value) || 0 
                  }))}
                />
              </div>

              <div>
                <Label htmlFor="days">Délai (jours) *</Label>
                <Input
                  id="days"
                  type="number"
                  min="1"
                  value={formData.estimatedDays}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    estimatedDays: parseInt(e.target.value) || 1 
                  }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Description optionnelle de l'article"
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                id="active"
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="active">Article actif</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditDialog(false);
                setCurrentArticle(null);
                resetForm();
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={handleEditArticle}
              disabled={!formData.name.trim() || formData.defaultPrice <= 0}
            >
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de suppression */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'article</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer l'article "{currentArticle?.name}" ?
              Cette action ne peut pas être annulée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteArticle}
              className="bg-red-600 hover:bg-red-700"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog d'actions en masse */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Actions en masse</DialogTitle>
            <DialogDescription>
              Appliquer une action à {selectedArticles.length} articles sélectionnés
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Type d'action</Label>
              <Select
                value={bulkAction}
                onValueChange={(value: 'price' | 'status') => setBulkAction(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="price">Mise à jour des prix</SelectItem>
                  <SelectItem value="status">Changement de statut</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {bulkAction === 'price' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="bulkAmount">Montant</Label>
                    <Input
                      id="bulkAmount"
                      type="number"
                      value={bulkPriceUpdate.amount}
                      onChange={(e) => setBulkPriceUpdate(prev => ({ 
                        ...prev, 
                        amount: parseFloat(e.target.value) || 0 
                      }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="bulkType">Type</Label>
                    <Select
                      value={bulkPriceUpdate.type}
                      onValueChange={(value: 'amount' | 'percentage') => 
                        setBulkPriceUpdate(prev => ({ ...prev, type: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Pourcentage</SelectItem>
                        <SelectItem value="amount">Montant fixe</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {bulkPriceUpdate.type === 'percentage' 
                    ? `${bulkPriceUpdate.amount > 0 ? 'Augmentation' : 'Réduction'} de ${Math.abs(bulkPriceUpdate.amount)}%`
                    : `${bulkPriceUpdate.amount > 0 ? 'Augmentation' : 'Réduction'} de ${formatCurrency(Math.abs(bulkPriceUpdate.amount))}`
                  }
                </p>
              </div>
            )}

            {bulkAction === 'status' && (
              <div>
                <Label>Nouveau statut</Label>
                <Select
                  value={bulkStatusUpdate ? 'active' : 'inactive'}
                  onValueChange={(value) => setBulkStatusUpdate(value === 'active')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Actif</SelectItem>
                    <SelectItem value="inactive">Inactif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleBulkAction}>
              Appliquer aux {selectedArticles.length} articles
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}