import { AlertTriangle } from 'react-lucide';

export const metadata = {
    title: '404 - Page non trouvée',
    description: 'La page que vous recherchez n\'existe pas.',
};

export default function NotFound() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
            <AlertTriangle size={64} strokeWidth={2} className="text-red-500" />
            <h1 className="mt-4 text-4xl font-extrabold text-gray-800">
                404 - Page non trouvée
            </h1>
            <p className="mt-2 text-lg text-gray-600">
                La page que vous recherchez n'existe pas.
            </p>
        </main>
    );
}