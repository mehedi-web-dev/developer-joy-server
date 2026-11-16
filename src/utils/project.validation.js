import { ObjectId } from 'mongodb';

/**
 * Checks if a string is a valid 24-character hexadecimal MongoDB ObjectId.
 */
export function isValidObjectId(id) {
  if (typeof id !== 'string') return false;
  return /^[0-9a-fA-F]{24}$/.test(id) && ObjectId.isValid(id);
}

/**
 * Checks if a string is a valid HTTP/HTTPS URL.
 */
export function isValidUrl(string) {
  if (typeof string !== 'string' || !string.trim()) return false;
  try {
    const url = new URL(string.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Transforms an arbitrary string into a clean, URL-safe slug.
 */
export function slugify(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/&/g, '-and-')
    .replace(/[^\w\s-]/g, '') // Remove non-word characters except hyphen and space
    .replace(/\s+/g, '-') // Replace whitespace with hyphen
    .replace(/-+/g, '-') // Replace consecutive hyphens with single hyphen
    .replace(/^-+/, '') // Trim hyphens from start
    .replace(/-+$/, ''); // Trim hyphens from end
}

/**
 * Generates a collision-free slug against the projects collection.
 * Appends -1, -2, etc. if the base slug already exists.
 *
 * @param {import('mongodb').Db} db - Active MongoDB database instance.
 * @param {string} title - The project title.
 * @param {ObjectId|string|null} [excludeId=null] - Project ID to exclude when updating.
 * @returns {Promise<string>} Unique slug.
 */
export async function generateUniqueSlug(db, title, excludeId = null) {
  const baseSlug = slugify(title) || 'project';
  let slug = baseSlug;
  let counter = 1;
  const collection = db.collection('projects');

  while (true) {
    const query = { slug };
    if (excludeId) {
      const objId = typeof excludeId === 'string' ? new ObjectId(excludeId) : excludeId;
      query._id = { $ne: objId };
    }

    const existing = await collection.findOne(query, { projection: { _id: 1 } });
    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

/**
 * Validates and sanitizes project data for creation or update.
 *
 * @param {object} data - Input payload from request body.
 * @param {boolean} [isUpdate=false] - Whether this is a partial update (PUT).
 * @returns {{ isValid: boolean, errors: string[], sanitizedData: object }}
 */
export function validateProjectInput(data, isUpdate = false) {
  const errors = [];
  const sanitized = {};

  if (!data || typeof data !== 'object') {
    return {
      isValid: false,
      errors: ['Invalid request payload. Expected a JSON object.'],
      sanitizedData: {},
    };
  }

  // Title validation
  if (!isUpdate || data.title !== undefined) {
    if (typeof data.title !== 'string' || !data.title.trim()) {
      errors.push('Title is required and must be a non-empty string.');
    } else if (data.title.trim().length < 2) {
      errors.push('Title must be at least 2 characters long.');
    } else if (data.title.trim().length > 200) {
      errors.push('Title must not exceed 200 characters.');
    } else {
      sanitized.title = data.title.trim();
    }
  }

  // Short description validation (optional)
  if (data.shortDescription !== undefined) {
    if (typeof data.shortDescription !== 'string') {
      errors.push('Short description must be a string.');
    } else if (data.shortDescription.trim().length > 500) {
      errors.push('Short description must not exceed 500 characters.');
    } else {
      sanitized.shortDescription = data.shortDescription.trim();
    }
  } else if (!isUpdate) {
    sanitized.shortDescription = '';
  }

  // Description validation (required)
  if (!isUpdate || data.description !== undefined) {
    if (typeof data.description !== 'string' || !data.description.trim()) {
      errors.push('Description is required and must be a non-empty string.');
    } else {
      sanitized.description = data.description.trim();
    }
  }

  // Thumbnail validation (required, valid URL)
  if (!isUpdate || data.thumbnail !== undefined) {
    if (typeof data.thumbnail !== 'string' || !data.thumbnail.trim()) {
      errors.push('Thumbnail is required.');
    } else if (!isValidUrl(data.thumbnail)) {
      errors.push('Thumbnail must be a valid HTTP or HTTPS URL.');
    } else {
      sanitized.thumbnail = data.thumbnail.trim();
    }
  }

  // Live URL validation (optional, must be valid URL if provided)
  if (data.liveUrl !== undefined) {
    if (data.liveUrl === '' || data.liveUrl === null) {
      sanitized.liveUrl = '';
    } else if (typeof data.liveUrl !== 'string' || !isValidUrl(data.liveUrl)) {
      errors.push('Live URL must be a valid HTTP or HTTPS URL.');
    } else {
      sanitized.liveUrl = data.liveUrl.trim();
    }
  } else if (!isUpdate) {
    sanitized.liveUrl = '';
  }

  // GitHub URL validation (optional, must be valid URL if provided)
  if (data.githubUrl !== undefined) {
    if (data.githubUrl === '' || data.githubUrl === null) {
      sanitized.githubUrl = '';
    } else if (typeof data.githubUrl !== 'string' || !isValidUrl(data.githubUrl)) {
      errors.push('GitHub URL must be a valid HTTP or HTTPS URL.');
    } else {
      sanitized.githubUrl = data.githubUrl.trim();
    }
  } else if (!isUpdate) {
    sanitized.githubUrl = '';
  }

  // Category validation (required)
  if (!isUpdate || data.category !== undefined) {
    if (typeof data.category !== 'string' || !data.category.trim()) {
      errors.push('Category is required and must be a non-empty string.');
    } else {
      sanitized.category = data.category.trim();
    }
  }

  // Technologies validation (optional array of strings)
  if (data.technologies !== undefined) {
    let techArray = data.technologies;
    if (typeof techArray === 'string') {
      techArray = techArray.split(',').map((t) => t.trim()).filter(Boolean);
    }
    if (!Array.isArray(techArray)) {
      errors.push('Technologies must be an array of strings.');
    } else {
      sanitized.technologies = techArray
        .filter((t) => typeof t === 'string' && t.trim().length > 0)
        .map((t) => t.trim());
    }
  } else if (!isUpdate) {
    sanitized.technologies = [];
  }

  // Featured validation (optional boolean)
  if (data.featured !== undefined) {
    sanitized.featured = Boolean(
      data.featured === true || data.featured === 'true' || data.featured === 1
    );
  } else if (!isUpdate) {
    sanitized.featured = false;
  }

  // Status validation ("draft" | "published")
  if (data.status !== undefined) {
    const normalizedStatus = String(data.status).toLowerCase().trim();
    if (normalizedStatus !== 'draft' && normalizedStatus !== 'published') {
      errors.push('Status must be either "draft" or "published".');
    } else {
      sanitized.status = normalizedStatus;
    }
  } else if (!isUpdate) {
    sanitized.status = 'draft';
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedData: sanitized,
  };
}
