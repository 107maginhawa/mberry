/**
 * Training repositories - Data access layer for trainings, enrollments, courses, and quizzes
 */

import { eq, and, type SQL } from 'drizzle-orm';
import type { DatabaseInstance } from '@/core/database';
import { DatabaseRepository } from '@/core/database.repo';
import { NotFoundError } from '@/core/errors';
import {
  trainings,
  trainingEnrollments,
  courses,
  courseEnrollments,
  quizAttempts,
  type Training,
  type NewTraining,
  type TrainingEnrollment,
  type NewTrainingEnrollment,
  type Course,
  type NewCourse,
  type CourseEnrollment,
  type NewCourseEnrollment,
  type QuizAttempt,
  type NewQuizAttempt,
} from './training.schema';

// ---------------------------------------------------------------------------
// TrainingRepository
// ---------------------------------------------------------------------------

export interface TrainingFilters {
  id?: string;
  organizationId?: string;
  status?: string;
  /** FIX-007 (M9-R1): filter by platform training delivery format. */
  type?: string;
}

export class TrainingRepository extends DatabaseRepository<Training, NewTraining, TrainingFilters> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, trainings, logger);
  }

  protected buildWhereConditions(filters?: TrainingFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;
    const conditions = [];

    if (filters.id) {
      conditions.push(eq(trainings.id, filters.id));
    }
    if (filters.organizationId) {
      conditions.push(eq(trainings.organizationId, filters.organizationId));
    }
    if (filters.status) {
      conditions.push(eq(trainings.status, filters.status as Training['status']));
    }
    if (filters.type) {
      conditions.push(eq(trainings.type, filters.type as NonNullable<Training['type']>));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  async publish(id: string): Promise<Training> {
    const [updated] = await this.db
      .update(trainings)
      .set({ status: 'published', publishedAt: new Date(), updatedAt: new Date() })
      .where(eq(trainings.id, id))
      .returning();

    if (!updated) throw new NotFoundError(`Training ${id} not found`, { resourceType: 'Training', resource: id });
    return updated as Training;
  }
}

// ---------------------------------------------------------------------------
// TrainingEnrollmentRepository
// ---------------------------------------------------------------------------

export interface TrainingEnrollmentFilters {
  trainingId?: string;
  personId?: string;
  status?: string;
}

export class TrainingEnrollmentRepository extends DatabaseRepository<
  TrainingEnrollment,
  NewTrainingEnrollment,
  TrainingEnrollmentFilters
> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, trainingEnrollments, logger);
  }

  protected buildWhereConditions(filters?: TrainingEnrollmentFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;
    const conditions = [];

    if (filters.trainingId) {
      conditions.push(eq(trainingEnrollments.trainingId, filters.trainingId));
    }
    if (filters.personId) {
      conditions.push(eq(trainingEnrollments.personId, filters.personId));
    }
    if (filters.status) {
      conditions.push(eq(trainingEnrollments.status, filters.status as TrainingEnrollment['status']));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }
}

// ---------------------------------------------------------------------------
// CourseRepository
// ---------------------------------------------------------------------------

export interface CourseFilters {
  organizationId?: string;
  status?: string;
}

export class CourseRepository extends DatabaseRepository<Course, NewCourse, CourseFilters> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, courses, logger);
  }

  protected buildWhereConditions(filters?: CourseFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;
    const conditions = [];

    if (filters.organizationId) {
      conditions.push(eq(courses.organizationId, filters.organizationId));
    }
    if (filters.status) {
      conditions.push(eq(courses.status, filters.status as Course['status']));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }
}

// ---------------------------------------------------------------------------
// CourseEnrollmentRepository
// ---------------------------------------------------------------------------

export interface CourseEnrollmentFilters {
  courseId?: string;
  personId?: string;
  status?: string;
}

export class CourseEnrollmentRepository extends DatabaseRepository<
  CourseEnrollment,
  NewCourseEnrollment,
  CourseEnrollmentFilters
> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, courseEnrollments, logger);
  }

  protected buildWhereConditions(filters?: CourseEnrollmentFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;
    const conditions = [];

    if (filters.courseId) {
      conditions.push(eq(courseEnrollments.courseId, filters.courseId));
    }
    if (filters.personId) {
      conditions.push(eq(courseEnrollments.personId, filters.personId));
    }
    if (filters.status) {
      conditions.push(eq(courseEnrollments.status, filters.status as CourseEnrollment['status']));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }
}

// ---------------------------------------------------------------------------
// QuizAttemptRepository
// ---------------------------------------------------------------------------

export interface QuizAttemptFilters {
  courseId?: string;
  personId?: string;
}

export class QuizAttemptRepository extends DatabaseRepository<
  QuizAttempt,
  NewQuizAttempt,
  QuizAttemptFilters
> {
  constructor(db: DatabaseInstance, logger?: any) {
    super(db, quizAttempts, logger);
  }

  protected buildWhereConditions(filters?: QuizAttemptFilters): SQL<unknown> | undefined {
    if (!filters) return undefined;
    const conditions = [];

    if (filters.courseId) {
      conditions.push(eq(quizAttempts.courseId, filters.courseId));
    }
    if (filters.personId) {
      conditions.push(eq(quizAttempts.personId, filters.personId));
    }

    return conditions.length > 0 ? and(...conditions) : undefined;
  }
}
