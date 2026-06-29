# jobs

A simple job board where anyone can post, edit, and delete jobs.

## Stories

- See a list of all jobs.
- Create a new job with a title, company, and salary.
- Edit a job's details.
- Delete a job.

## Models

### Job

- `title` — text, required
- `company` — text, required
- `salary` — text, required (can be a range like "80k–120k" or "competitive")
- `createdAt` — datetime, set on create
