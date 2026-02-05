import { supabase } from '@/lib/supabase';
import { formatDate, stageBadgeColor } from '@/lib/utils';
import Link from 'next/link';

export const revalidate = 30;

interface ContactsPageProps {
  searchParams: { search?: string; stage?: string };
}

async function getContacts(search?: string, stage?: string) {
  let query = supabase
    .from('contacts')
    .select('id, email, name, company_name, stage, owner_agent, last_touch_at, tags, created_at')
    .order('last_touch_at', { ascending: false, nullsFirst: false })
    .limit(50);

  if (stage) {
    query = query.eq('stage', stage);
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,company_name.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) console.error('Error fetching contacts:', error);
  return data || [];
}

const STAGES = ['prospect', 'lead', 'opportunity', 'customer', 'churned'];

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  const contacts = await getContacts(searchParams.search, searchParams.stage);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
        <p className="text-sm text-gray-500 mt-1">{contacts.length} contacts found</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href="/contacts"
          className={`badge ${!searchParams.stage ? 'bg-cortex-100 text-cortex-800' : 'badge-gray'} cursor-pointer`}
        >
          All
        </Link>
        {STAGES.map((stage) => (
          <Link
            key={stage}
            href={`/contacts?stage=${stage}${searchParams.search ? `&search=${searchParams.search}` : ''}`}
            className={`badge ${searchParams.stage === stage ? 'bg-cortex-100 text-cortex-800' : stageBadgeColor(stage)} cursor-pointer`}
          >
            {stage}
          </Link>
        ))}
      </div>

      {/* Search */}
      <form className="max-w-md">
        <input
          type="text"
          name="search"
          defaultValue={searchParams.search || ''}
          placeholder="Search by name, email, or company..."
          className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-cortex-500 focus:outline-none focus:ring-1 focus:ring-cortex-500"
        />
      </form>

      {/* Contact List */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Contact</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Company</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Stage</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Owner</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Last Touch</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {contacts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500">
                  No contacts found
                </td>
              </tr>
            ) : (
              contacts.map((contact: any) => (
                <tr key={contact.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <Link href={`/contacts/${contact.id}`} className="block">
                      <p className="text-sm font-medium text-gray-900 hover:text-cortex-600">
                        {contact.name || '(unnamed)'}
                      </p>
                      <p className="text-xs text-gray-500">{contact.email}</p>
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {contact.company_name || '-'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`badge ${stageBadgeColor(contact.stage)}`}>
                      {contact.stage}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {contact.owner_agent || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {formatDate(contact.last_touch_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
