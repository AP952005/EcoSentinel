/**
 * Avatar asset mapping for EcoSentinel mascot.
 * States correspond to supplied PNG files in /assets/avatars/
 */

export type AvatarState =
  | 'idle'
  | 'greeting'
  | 'scanning'
  | 'investigating'
  | 'processing'
  | 'cycling_left'
  | 'cycling_right'
  | 'success';

export const AVATAR_ASSETS: Record<AvatarState, string> = {
  idle: '/assets/avatars/general.png',
  greeting: '/assets/avatars/Hi.png',
  scanning: '/assets/avatars/Scanner.png',
  investigating: '/assets/avatars/Investigator.png',
  processing: '/assets/avatars/Processing.png',
  cycling_left: '/assets/avatars/towardsleftcycling.png',
  cycling_right: '/assets/avatars/towardsrightcycling.png',
  success: '/assets/avatars/Success.png',
};

export const TOUR_STEPS = [
  {
    step: 1,
    title: 'Welcome to EcoSentinel',
    avatar: 'greeting' as AvatarState,
    anchor: 'welcome',
    route: '/',
    narration:
      "Welcome to EcoSentinel. I'll show you how the platform helps you create a First Environmental Report, investigate candidate environmental changes and keep track of the evidence behind each case.",
  },
  {
    step: 2,
    title: 'Investigation Dashboard',
    avatar: 'idle' as AvatarState,
    anchor: 'dashboard',
    route: '/dashboard',
    narration:
      "This is your investigation dashboard. It shows the projects and cases available to your account, recently generated reports, active monitoring plans and items awaiting review.",
  },
  {
    step: 3,
    title: 'Create a Project',
    avatar: 'idle' as AvatarState,
    anchor: 'fer-form',
    route: '/projects/new',
    narration:
      "Start with a project. Enter the available application details, select the project type and provide the location and supporting information you have. Fields vary by project category and application stage.",
  },
  {
    step: 4,
    title: 'FER Generation',
    avatar: 'processing' as AvatarState,
    anchor: 'fer-report',
    route: '/dashboard',
    narration:
      "After you submit the project, EcoSentinel assembles an initial First Environmental Report. It summarizes the submitted information, available environmental context, early observations and questions the reviewer may need to investigate.",
  },
  {
    step: 5,
    title: 'FER Evidence',
    avatar: 'investigating' as AvatarState,
    anchor: 'fer-evidence',
    route: '/dashboard',
    narration:
      "Every finding should show where it came from. Open its sources, inspect the relevant document page or dataset and check what the available evidence actually supports.",
  },
  {
    step: 6,
    title: 'Location & Baseline',
    avatar: 'scanning' as AvatarState,
    anchor: 'map-view',
    route: '/map',
    narration:
      "Explore the project boundary and the available historical observations. We show the actual observation dates and data limitations, because data downloaded today is not necessarily a current observation.",
  },
  {
    step: 7,
    title: 'Zone A and Zone B',
    avatar: 'scanning' as AvatarState,
    anchor: 'shadow-footprint',
    route: '/shadow-footprint',
    narration:
      "Zone A is the project's declared or approved core footprint. Zone B is a configurable surrounding investigation area. We compare them to surface candidate changes that may deserve attention.",
  },
  {
    step: 8,
    title: 'Challenge This Finding',
    avatar: 'investigating' as AvatarState,
    anchor: 'challenge-finding',
    route: '/dashboard',
    narration:
      "When a candidate change appears, challenge it. Examine data quality, historical context, supporting and contradictory evidence, alternative explanations and the questions that remain unresolved.",
  },
  {
    step: 9,
    title: 'Watchtower',
    avatar: 'scanning' as AvatarState,
    anchor: 'watchtower',
    route: '/watchtower',
    narration:
      "Watchtower saves a monitoring plan and maintains the case as new usable observations arrive. It distinguishes new findings from failed scans and periods when suitable data are unavailable.",
  },
  {
    step: 10,
    title: 'Case History',
    avatar: 'investigating' as AvatarState,
    anchor: 'case-history',
    route: '/dashboard',
    narration:
      "Record reviewer actions, questions and follow-up. Later observations can update the same case so that the investigation has a traceable history.",
  },
  {
    step: 11,
    title: 'Chat & Voice',
    avatar: 'idle' as AvatarState,
    anchor: 'chat',
    route: '/chat',
    narration:
      "Ask the case assistant questions about the evidence, and listen to a short briefing of the current case. Answers are grounded in the material available to EcoSentinel.",
  },
  {
    step: 12,
    title: 'Ready to Investigate',
    avatar: 'success' as AvatarState,
    anchor: 'complete',
    route: '/dashboard',
    narration:
      "You have reached the end of the tour. You can now create a project, generate a FER and explore a case. Remember that EcoSentinel supports environmental investigation; it does not replace an officer's judgment.",
  },
];
