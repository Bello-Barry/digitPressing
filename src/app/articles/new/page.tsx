'use client';

// =============================================================================
// PAGE CRÉATION D'ARTICLE - Digit PRESSING
// =============================================================================

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Save, 
  ArrowLeft,
  AlertTriangle,
  Package,
  Info
} from 'lucide-react';
import { useArticleActions } from '@/store/articles';
import { useAuth, useUserPermissions } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from '@/components/ui/select';
import { formatCurrency, capitalizeWords } from '@/lib/utils';

const _CATEGORY_CONFIG = {
  vetement: { label: 'Vêtements', color: 'bg-blue-100 text-blue-800', icon: '👔', description: 'Chemises, pantalons, robes, costumes, manteaux...' },
  chaussure: { label: 'Chaussures', color: 'bg-brown-100 text-brown-800', icon: '👞', description: 'Baskets, bottes, chaussures de ville...' },
  accessoire: { label: 'Accessoires', color: 'bg-purple-100 text-purple-800', icon: '👜', description: 'Cravates, foulards, sacs, chapeaux...' },
  maison: { label: 'Maison', color: 'bg-green-100 text-green-800', icon: '🏠', description: 'Draps, rideaux, nappes, couvertures...' },
  traditionnel: { label: 'Traditionnel', color: 'bg-orange-100 text-orange-800', icon: '👘', description: 'Tenues africaines, bazin, boubous...' },
  delicat: { label: 'Délicat', color: 'bg-pink-100 text-pink-800', icon: '🌸', description: 'Sous-vêtements, lingerie, dentelles...' },
  ceremonie: { label: 'Cérémonie', color: 'bg-yellow-100 text-yellow-800', icon: '💒', description: 'Robe de mariée, costumes cérémonie...' },
  enfant: { label: 'Enfant', color: 'bg-cyan-100 text-cyan-800', icon: '👶', description: 'Vêtements pour enfants, pyjamas...' },
  uniforme: { label: 'Uniformes', color: 'bg-indigo-100 text-indigo-800', icon: '👮', description: 'Scolaires, professionnels, médicaux...' },
  cuir: { label: 'Cuir', color: 'bg-amber-100 text-amber-800', icon: '🧥', description: 'Vestes, pantalons, sacs et accessoires en cuir...' },
  retouche: { label: 'Retouche', color: 'bg-teal-100 text-teal-800', icon: '✂️', description: 'Ourlets, ajustements, fermetures...' },
  special: { label: 'Spécial', color: 'bg-red-100 text-red-800', icon: '⭐', description: 'Nettoyage spécial, tapis, cuirs délicats...' }
};

interface ArticleFormData {
  name: string;
  category: keyof typeof CATEGORY_CONFIG;
  defaultPrice: number;
  description: string;
  estimatedDays: number;
  isActive: boolean;
}

const _COMMON_ARTICLES_BY_CATEGORY = {
  vetement: [
    { name: 'Chemise homme', price: 5000 },
    { name: 'Chemise femme', price: 5000 },
    { name: 'Pantalon homme', price: 7000 },
    { name: 'Pantalon femme', price: 7000 },
    { name: 'Jean', price: 6000 },
    { name: 'Robe courte', price: 8000 },
    { name: 'Robe longue', price: 10000 },
    { name: 'Veste / Blazer', price: 9000 },
    { name: 'T-shirt', price: 3500 },
    { name: 'Pull / Gilet', price: 6500 },
    { name: 'Manteau', price: 15000 },
    { name: 'Doudoune', price: 18000 },
    { name: 'Costume 2 pièces', price: 20000 },
    { name: 'Costume 3 pièces', price: 25000 },
    { name: 'Jupe', price: 6000 },
    { name: 'Short', price: 4000 }
  ],
  chaussure: [
    { name: 'Basket', price: 7000 },
    { name: 'Chaussure ville', price: 6000 },
    { name: 'Bottes cuir', price: 10000 },
    { name: 'Sandales', price: 5000 }
  ],
  accessoire: [
    { name: 'Cravate', price: 3000 },
    { name: 'Écharpe', price: 4000 },
    { name: 'Foulard', price: 3500 },
    { name: 'Casquette', price: 2000 },
    { name: 'Chapeau', price: 5000 },
    { name: 'Sac à main (tissu)', price: 7000 }
  ],
  maison: [
    { name: 'Serviette', price: 3000 },
    { name: 'Couverture', price: 10000 },
    { name: 'Draps de lit', price: 7000 },
    { name: 'Nappe de table', price: 8000 },
    { name: 'Rideaux légers', price: 12000 },
    { name: 'Rideaux lourds', price: 20000 },
    { name: 'Coussin', price: 4000 }
  ],
  traditionnel: [
    { name: 'Ensemble Bazin homme', price: 25000 },
    { name: 'Ensemble Bazin femme', price: 25000 },
    { name: 'Ensemble pagne homme', price: 15000 },
    { name: 'Ensemble pagne femme', price: 15000 },
    { name: 'Boubou traditionnel', price: 18000 }
  ],
  delicat: [
    { name: 'Sous-vêtement simple', price: 2000 },
    { name: 'Lingerie délicate', price: 5000 },
    { name: 'Voile / Dentelle', price: 7000 }
  ],
  ceremonie: [
    { name: 'Robe de soirée', price: 25000 },
    { name: 'Robe de mariée', price: 50000 },
    { name: 'Costume cérémonie', price: 30000 },
    { name: 'Tenue traditionnelle luxe', price: 35000 }
  ],
  enfant: [
    { name: 'Chemise enfant', price: 3000 },
    { name: 'Pantalon enfant', price: 4000 },
    { name: 'Robe enfant', price: 5000 },
    { name: 'Pyjama enfant', price: 3500 }
  ],
  uniforme: [
    { name: 'Uniforme scolaire', price: 5000 },
    { name: 'Uniforme professionnel', price: 7000 },
    { name: 'Blouse médicale', price: 6000 }
  ],
  cuir: [
    { name: 'Veste en cuir', price: 15000 },
    { name: 'Pantalon cuir', price: 12000 },
    { name: 'Sac cuir', price: 10000 },
    { name: 'Ceinture cuir', price: 5000 }
  ],
  retouche: [
    { name: 'Ourlet pantalon', price: 3000 },
    { name: 'Ajustement taille veste', price: 5000 },
    { name: 'Changement fermeture éclair', price: 7000 }
  ],
  special: [
    { name: 'Nettoyage détachage spécial', price: 8000 },
    { name: 'Nettoyage tapis', price: 20000 },
    { name: 'Cuir délicat (sac / veste)', price: 15000 }
  ]
};



export default function NewArticlePage() {
  const _router = useRouter();
  const { user } = useAuth();
  const _permissions = useUserPermissions();
  
  // Actions du store
  const { createArticle } = useArticleActions();

  // État du formulaire
  const [formData, setFormData] = useState<ArticleFormData>({
    name: '',
    category: 'vetement',
    defaultPrice: 0,
    description: '',
    estimatedDays: 3,
    isActive: true,
  });

  // États locaux
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);

  // Vérification des permissions
  const _canModifyPrices = permissions.isOwner || permissions.canModifyPrices;

  useEffect(() => {
    if (user && !canModifyPrices) {
      router.push('/articles');
    }
  }, [user, canModifyPrices, router]);

  // Suggestions d'articles pour la catégorie sélectionnée
  const _suggestions = COMMON_ARTICLES_BY_CATEGORY[formData.category] || [];

  // Mise à jour des champs du formulaire
  const _updateFormData = (updates: Partial<ArticleFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  // Utiliser une suggestion
  const _useSuggestion = (suggestion: { name: string; price: number }) => {
    updateFormData({
      name: suggestion.name,
      defaultPrice: suggestion.price
    });
    setShowSuggestions(false);
  };

  // Soumission du formulaire
  const _handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !canModifyPrices) return;

    // Validation
    if (!formData.name.trim()) {
      setError('Le nom de l\'article est obligatoire');
      return;
    }

    if (formData.defaultPrice <= 0) {
      setError('Le prix doit être supérieur à 0');
      return;
    }

    if (formData.estimatedDays <= 0) {
      setError('Le délai doit être supérieur à 0');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await createArticle({
        name: capitalizeWords(formData.name.trim()),
        category: formData.category,
        defaultPrice: formData.defaultPrice,
        description: formData.description.trim()  || null,
        estimatedDays: formData.estimatedDays,
        isActive: formData.isActive,
        pressingId: user.pressingId,
      });

      // Rediriger vers la liste des articles
      router.push('/articles');
    } catch (error: any) {
      console.error('Erreur lors de la création:', error);
      setError(error.message || 'Erreur lors de la création de l\'article');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Réinitialiser le formulaire
  const _resetForm = () => {
    setFormData({
      name: '',
      category: 'vetement',
      defaultPrice: 0,
      description: '',
      estimatedDays: 3,
      isActive: true,
    });
    setShowSuggestions(true);
    setError(null);
  };

  if (!user || !canModifyPrices) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-600" />
        <h2 className="text-xl font-semibold mb-2">Accès refusé</h2>
        <p className="text-muted-foreground mb-4">
          Vous n'avez pas l'autorisation de créer des articles.
        </p>
        <Button asChild>
          <Link href="/articles">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour aux articles
          </Link>
        </Button>
      </div>
    );
  }

  const _selectedCategoryConfig = CATEGORY_CONFIG[formData.category];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          asChild
        >
          <Link href="/articles">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        
        <div>
          <h1 className="text-3xl font-bold">Nouvel article</h1>
          <p className="text-muted-foreground">
            Ajouter un nouvel article au catalogue de services
          </p>
        </div>
      </div>

      {/* Erreur */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <p className="text-red-800">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Informations de base */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Informations de base
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Nom de l'article *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateFormData({ name: e.target.value })}
                placeholder="Ex: Chemise homme, Pantalon femme..."
                required
              />
            </div>

            <div>
              <Label htmlFor="category">Catégorie *</Label>
              <Select
                value={formData.category}
                onValueChange={(value: keyof typeof CATEGORY_CONFIG) => 
                  updateFormData({ category: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORY_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <span>{config.icon}</span>
                        <span>{config.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="mt-2 p-3 bg-gray-50 rounded-md">
                <div className="flex items-center gap-2">
                  <Badge className={selectedCategoryConfig.color}>
                    {selectedCategoryConfig.icon} {selectedCategoryConfig.label}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedCategoryConfig.description}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price">Prix (FCFA) *</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="100"
                  value={formData.defaultPrice}
                  onChange={(e) => updateFormData({ 
                    defaultPrice: parseFloat(e.target.value) || 0 
                  })}
                  placeholder="0"
                  required
                />
                {formData.defaultPrice > 0 && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Prix affiché: {formatCurrency(formData.defaultPrice)}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="days">Délai estimé (jours) *</Label>
                <Input
                  id="days"
                  type="number"
                  min="1"
                  max="30"
                  value={formData.estimatedDays}
                  onChange={(e) => updateFormData({ 
                    estimatedDays: parseInt(e.target.value) || 1 
                  })}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description (optionnelle)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => updateFormData({ description: e.target.value })}
                placeholder="Détails supplémentaires sur l'article, instructions spéciales..."
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                id="active"
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => updateFormData({ isActive: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="active">Article actif (disponible à la sélection)</Label>
            </div>
          </CardContent>
        </Card>

        {/* Suggestions d'articles populaires */}
        {suggestions.length > 0 && showSuggestions && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Articles populaires dans cette catégorie
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {suggestions.map((suggestion, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => useSuggestion(suggestion)}
                  >
                    <span className="font-medium">{suggestion.name}</span>
                    <span className="text-primary font-bold">
                      {formatCurrency(suggestion.price)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                Cliquez sur un article pour utiliser ses informations comme base
              </p>
            </CardContent>
          </Card>
        )}

        {/* Aperçu de l'article */}
        {formData.name.trim() && (
          <Card>
            <CardHeader>
              <CardTitle>Aperçu de l'article</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{formData.name}</span>
                    <Badge className={selectedCategoryConfig.color}>
                      {selectedCategoryConfig.icon} {selectedCategoryConfig.label}
                    </Badge>
                    {!formData.isActive && (
                      <Badge variant="secondary">Inactif</Badge>
                    )}
                  </div>
                  {formData.description && (
                    <p className="text-sm text-muted-foreground mb-2">
                      {formData.description}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Délai estimé: {formData.estimatedDays} jour{formData.estimatedDays > 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-primary">
                    {formatCurrency(formData.defaultPrice)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={resetForm}
            disabled={isSubmitting}
          >
            Réinitialiser
          </Button>
          
          <Button
            type="button"
            variant="outline"
            asChild
            disabled={isSubmitting}
          >
            <Link href="/articles">
              Annuler
            </Link>
          </Button>
          
          <Button
            type="submit"
            disabled={
              isSubmitting || 
              !formData.name.trim() || 
              formData.defaultPrice <= 0 ||
              formData.estimatedDays <= 0
            }
          >
            <Save className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Création...' : 'Créer l\'article'}
          </Button>
        </div>
      </form>
    </div>
  );
}