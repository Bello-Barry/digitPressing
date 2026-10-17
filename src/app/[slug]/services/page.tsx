import { redirect } from 'next/navigation';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ServicesPage({ params }: PageProps) {
  const { slug } = await params;
  redirect(`/${slug}/tarifs`);
}
