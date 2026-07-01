import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getApiInfo() {
    return {
      name: 'CAMH Risk Index Backend',
      status: 'ok',
      landingPageDataEndpoint: '/api/public/dashboard',
      routes: {
        auth: {
          signup: 'POST /api/auth/signup',
          login: 'POST /api/auth/login',
          me: 'GET /api/auth/me',
        },
        public: {
          divisions: 'GET /api/public/divisions',
          locationHierarchy: 'GET /api/public/locations/hierarchy',
          districtsByDivision:
            'GET /api/public/locations/districts?divisionCode=30',
          upazilasByDistrict:
            'GET /api/public/locations/districts/:slug/upazilas',
          landingPage: 'GET /api/public/landing-page',
          dashboard: 'GET /api/public/dashboard',
          districts: 'GET /api/public/districts',
          districtBySlug: 'GET /api/public/districts/:slug',
        },
        researcher: {
          createSubmission: 'POST /api/researcher/submissions',
          mySubmissions: 'GET /api/researcher/submissions/mine',
        },
        admin: {
          divisions: 'GET /api/admin/divisions',
          locationHierarchy: 'GET /api/admin/locations/hierarchy',
          districtsByDivision:
            'GET /api/admin/locations/districts?divisionCode=30',
          upazilasByDistrict:
            'GET /api/admin/locations/districts/:districtCode/upazilas',
          districts: 'GET /api/admin/districts',
          publishedSubmissions: 'GET /api/admin/submissions/published',
          createPublishedSubmission: 'POST /api/admin/submissions',
          pendingResearchers: 'GET /api/admin/users/pending',
          approveResearcher: 'PATCH /api/admin/users/:id/approve',
          pendingSubmissions: 'GET /api/admin/submissions/pending',
          publishSubmission: 'PATCH /api/admin/submissions/:id/publish',
          rejectSubmission: 'PATCH /api/admin/submissions/:id/reject',
        },
      },
    };
  }
}
