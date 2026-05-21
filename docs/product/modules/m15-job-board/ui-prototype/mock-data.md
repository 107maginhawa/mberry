<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# UI Blueprint -- Mock Data: Job Board (M15)

> Mock data is for UI demonstration only. It must not be treated as final schema, API contract, lifecycle state, or business rule.

---

## Mock Entity: JobPosting

```json
[
  {
    "id": "job-001-uuid-abcd",
    "organizationId": "org-cebu-dental-uuid",
    "title": "Associate Dentist — General Practice",
    "organizationName": "Cebu Dental Wellness Center",
    "description": "We are looking for a licensed dentist to join our growing practice in Cebu City. You will provide comprehensive dental care including preventive, restorative, and cosmetic procedures. Collaborative team environment with modern equipment and a supportive staff.",
    "type": "full_time",
    "location": "Cebu City, Cebu",
    "salary": "PHP 60,000 - 85,000/month",
    "specialty": "General Dentistry",
    "requirements": [
      "Licensed dentist (PRC board passer)",
      "Minimum 2 years clinical experience",
      "Proficient in restorative and preventive procedures",
      "Excellent patient communication skills",
      "CPD credits current"
    ],
    "applicationUrl": null,
    "applicationEmail": "careers@cebudental.com",
    "status": "active",
    "expiresAt": "2026-06-18T00:00:00Z",
    "postedAt": "2026-05-19T08:00:00Z",
    "postedBy": "person-dr-reyes-uuid",
    "createdAt": "2026-05-19T08:00:00Z",
    "updatedAt": "2026-05-19T08:00:00Z",
    "isBookmarked": false
  },
  {
    "id": "job-002-uuid-efgh",
    "organizationId": "org-cebu-dental-uuid",
    "title": "Orthodontist — Part-Time",
    "organizationName": "SmileLine Orthodontics",
    "description": "Seeking a skilled orthodontist for part-time work (3 days/week) at our Mandaue City branch. Modern facility with digital imaging and CAD/CAM capabilities. Competitive compensation based on production.",
    "type": "part_time",
    "location": "Mandaue City, Cebu",
    "salary": "PHP 3,500 - 5,000/patient",
    "specialty": "Orthodontics",
    "requirements": [
      "Board-certified orthodontist",
      "Experience with clear aligner therapy",
      "Digital treatment planning proficiency",
      "Minimum 3 years post-residency experience"
    ],
    "applicationUrl": "https://smileline.ph/careers/orthodontist",
    "applicationEmail": null,
    "status": "active",
    "expiresAt": "2026-06-10T00:00:00Z",
    "postedAt": "2026-05-11T10:30:00Z",
    "postedBy": "person-dr-santos-uuid",
    "createdAt": "2026-05-11T10:30:00Z",
    "updatedAt": "2026-05-11T10:30:00Z",
    "isBookmarked": true
  },
  {
    "id": "job-003-uuid-ijkl",
    "organizationId": "org-cebu-dental-uuid",
    "title": "Dental Fellowship — Pediatric Dentistry",
    "organizationName": "Cebu Children's Dental Hospital",
    "description": "One-year fellowship program in pediatric dentistry. Training includes sedation dentistry, special needs patients, and hospital-based care. Stipend provided with opportunity for permanent placement.",
    "type": "fellowship",
    "location": "Cebu City, Cebu",
    "salary": "PHP 35,000/month stipend",
    "specialty": "Pediatric Dentistry",
    "requirements": [
      "Licensed dentist",
      "Interest in pediatric dentistry",
      "Willingness to complete 1-year commitment",
      "BLS certification"
    ],
    "applicationUrl": null,
    "applicationEmail": "fellowship@cebuchildrensdental.ph",
    "status": "active",
    "expiresAt": "2026-05-25T00:00:00Z",
    "postedAt": "2026-04-25T09:00:00Z",
    "postedBy": "person-dr-garcia-uuid",
    "createdAt": "2026-04-25T09:00:00Z",
    "updatedAt": "2026-04-25T09:00:00Z",
    "isBookmarked": false
  },
  {
    "id": "job-004-uuid-mnop",
    "organizationId": "org-cebu-dental-uuid",
    "title": "Dental Hygienist — Contract",
    "organizationName": "BrightSmile Dental Group",
    "description": "6-month contract position for a dental hygienist to support our expanded patient base. Duties include scaling, polishing, fluoride treatments, and patient education. Possibility of extension.",
    "type": "contract",
    "location": "Lapu-Lapu City, Cebu",
    "salary": "PHP 25,000 - 30,000/month",
    "specialty": null,
    "requirements": [
      "Registered dental hygienist",
      "Minimum 1 year experience",
      "Strong patient education skills"
    ],
    "applicationUrl": null,
    "applicationEmail": "hr@brightsmile.ph",
    "status": "active",
    "expiresAt": "2026-06-15T00:00:00Z",
    "postedAt": "2026-05-16T14:00:00Z",
    "postedBy": "person-dr-lim-uuid",
    "createdAt": "2026-05-16T14:00:00Z",
    "updatedAt": "2026-05-16T14:00:00Z",
    "isBookmarked": false
  },
  {
    "id": "job-005-uuid-qrst",
    "organizationId": "org-cebu-dental-uuid",
    "title": "Dental Intern — Summer Program",
    "organizationName": "Cebu Dental Chapter Community Clinic",
    "description": "8-week summer internship for dental students. Hands-on clinical experience under supervision in community dental care. No salary but CPD credits awarded upon completion.",
    "type": "internship",
    "location": "Cebu City, Cebu",
    "salary": null,
    "specialty": null,
    "requirements": [
      "Currently enrolled in accredited dental program",
      "Completed pre-clinical coursework",
      "Available for 8 consecutive weeks"
    ],
    "applicationUrl": null,
    "applicationEmail": "internship@cebudentalchapter.org",
    "status": "active",
    "expiresAt": "2026-06-01T00:00:00Z",
    "postedAt": "2026-05-01T08:00:00Z",
    "postedBy": "person-dr-reyes-uuid",
    "createdAt": "2026-05-01T08:00:00Z",
    "updatedAt": "2026-05-01T08:00:00Z",
    "isBookmarked": true
  }
]
```

### Mock Status Values (JobPosting)
- **draft:** Saved but not yet published. Visible only to posting officer/employer.
- **active:** Published and visible to all members.
- **filled:** Position filled. Removed from active listings, visible as "Filled" if accessed directly.
- **expired:** Auto-expired after 30 days (or custom date). Not shown in default listing view.
- **closed:** Manually closed by poster. Not shown in default listing view.
- **pendingReview:** External employer submission awaiting admin approval (M15-R2).

---

## Mock Entity: JobApplication

```json
[
  {
    "id": "app-001-uuid-abcd",
    "jobPostingId": "job-001-uuid-abcd",
    "personId": "person-dr-mendoza-uuid",
    "resumeUrl": "https://cdn.example.com/resumes/mendoza-cv-2026.pdf",
    "coverLetter": "I am excited to apply for the Associate Dentist position. With 4 years of experience in general practice and a passion for patient-centered care, I believe I would be a strong addition to your team.",
    "status": "submitted",
    "appliedAt": "2026-05-20T11:00:00Z",
    "createdAt": "2026-05-20T11:00:00Z",
    "updatedAt": "2026-05-20T11:00:00Z"
  },
  {
    "id": "app-002-uuid-efgh",
    "jobPostingId": "job-001-uuid-abcd",
    "personId": "person-dr-cruz-uuid",
    "resumeUrl": "https://cdn.example.com/resumes/cruz-cv-2026.pdf",
    "coverLetter": null,
    "status": "submitted",
    "appliedAt": "2026-05-21T09:30:00Z",
    "createdAt": "2026-05-21T09:30:00Z",
    "updatedAt": "2026-05-21T09:30:00Z"
  },
  {
    "id": "app-003-uuid-ijkl",
    "jobPostingId": "job-003-uuid-ijkl",
    "personId": "person-dr-villanueva-uuid",
    "resumeUrl": "https://cdn.example.com/resumes/villanueva-cv-2026.pdf",
    "coverLetter": "As a recent graduate with a strong interest in pediatric dentistry, this fellowship would be an ideal opportunity to develop my skills in this specialty area.",
    "status": "submitted",
    "appliedAt": "2026-05-18T15:00:00Z",
    "createdAt": "2026-05-18T15:00:00Z",
    "updatedAt": "2026-05-18T15:00:00Z"
  }
]
```

### Mock Status Values (JobApplication)
- **submitted:** Application received and pending employer review.
- **reviewed:** Employer has viewed the application.
- **shortlisted:** Applicant moved to shortlist.
- **rejected:** Application declined.

---

## Mock Entity: JobBookmark

```json
[
  {
    "id": "bm-001-uuid",
    "personId": "person-dr-mendoza-uuid",
    "jobPostingId": "job-002-uuid-efgh",
    "createdAt": "2026-05-12T10:00:00Z"
  },
  {
    "id": "bm-002-uuid",
    "personId": "person-dr-mendoza-uuid",
    "jobPostingId": "job-005-uuid-qrst",
    "createdAt": "2026-05-02T16:30:00Z"
  }
]
```

---

## Mock Entity: JobAlert

```json
[
  {
    "id": "alert-001-uuid",
    "personId": "person-dr-mendoza-uuid",
    "keyword": "orthodontist",
    "type": null,
    "specialty": "Orthodontics",
    "location": null,
    "createdAt": "2026-05-10T09:00:00Z"
  },
  {
    "id": "alert-002-uuid",
    "personId": "person-dr-mendoza-uuid",
    "keyword": null,
    "type": "fellowship",
    "specialty": null,
    "location": "Cebu",
    "createdAt": "2026-05-15T11:00:00Z"
  }
]
```

---

### Prototype-Only Assumptions
- isBookmarked field on job listing is a computed/joined field from the API, not stored on the job_posting entity
- Application status workflow (submitted -> reviewed -> shortlisted/rejected) follows MODULE_SPEC section 8 state transitions
- Job alert matching logic (keyword, type, specialty, location) is server-side; mock shows the preference shape only
- Resume upload uses the storage module (M18 Storage); resumeUrl is the stored file URL after upload
- 30-day auto-expiry (M15-R3) is system-enforced; expiresAt defaults to createdAt + 30 days
