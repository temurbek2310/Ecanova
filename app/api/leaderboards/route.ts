import { NextResponse } from 'next/server';

export const mockLeaderboard = [
  {
    id: 'lb_1',
    name: 'SamarkandQuant',
    speedScore: 98,
    accuracyScore: 99.4,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    rank: 1,
    pseudonym: 'SamarkandQuant',
    cohortXp: 920,
  },
  {
    id: 'lb_2',
    name: 'TashkentScholar',
    speedScore: 95,
    accuracyScore: 97.2,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80',
    rank: 2,
    pseudonym: 'TashkentScholar',
    cohortXp: 845,
  },
  {
    id: 'lb_3',
    name: 'BukharaAnalyst',
    speedScore: 91,
    accuracyScore: 94.8,
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80',
    rank: 3,
    pseudonym: 'BukharaAnalyst',
    cohortXp: 790,
  },
  {
    id: 'lb_4',
    name: 'FerganaGauss',
    speedScore: 88,
    accuracyScore: 92.5,
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80',
    rank: 4,
    pseudonym: 'FerganaGauss',
    cohortXp: 715,
  },
  {
    id: 'lb_5',
    name: 'KhivaSpectral',
    speedScore: 84,
    accuracyScore: 89.1,
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
    rank: 5,
    pseudonym: 'KhivaSpectral',
    cohortXp: 660,
  },
];

export async function GET() {
  return NextResponse.json(mockLeaderboard);
}
