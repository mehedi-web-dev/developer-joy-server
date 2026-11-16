import { ObjectId } from 'mongodb';
import { getDB } from '../config/db.js';
import {
  isValidObjectId,
  validateProjectInput,
  generateUniqueSlug,
} from '../utils/project.validation.js';

/**
 * Public: Get published projects with filtering and pagination.
 * GET /api/projects
 */
export async function getPublicProjects(req, res, next) {
  try {
    const db = getDB();
    const collection = db.collection('projects');

    // Strictly restrict to published projects for public access
    const filter = { status: 'published' };

    // Filter by category
    if (req.query.category && typeof req.query.category === 'string') {
      filter.category = { $regex: new RegExp(`^${req.query.category.trim()}$`, 'i') };
    }

    // Filter by featured flag
    if (req.query.featured !== undefined) {
      filter.featured = req.query.featured === 'true' || req.query.featured === '1';
    }

    // Optional text search in title, shortDescription, or technologies
    if (req.query.search && typeof req.query.search === 'string') {
      const searchRegex = new RegExp(req.query.search.trim(), 'i');
      filter.$or = [
        { title: searchRegex },
        { shortDescription: searchRegex },
        { technologies: searchRegex },
      ];
    }

    // Pagination
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const [projects, total] = await Promise.all([
      collection
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collection.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return res.status(200).json({
      success: true,
      count: projects.length,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      data: projects,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Public: Get a single published project by ObjectId or Slug.
 * GET /api/projects/:id
 */
export async function getPublicProjectById(req, res, next) {
  try {
    const db = getDB();
    const collection = db.collection('projects');
    const { id } = req.params;

    let filter;
    if (isValidObjectId(id)) {
      filter = {
        $or: [{ _id: new ObjectId(id) }, { slug: id }],
        status: 'published',
      };
    } else {
      filter = { slug: id, status: 'published' };
    }

    const project = await collection.findOne(filter);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or is not published',
      });
    }

    return res.status(200).json({
      success: true,
      data: project,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Get all projects (including drafts) with filtering and pagination.
 * GET /api/admin/projects
 */
export async function getAdminProjects(req, res, next) {
  try {
    const db = getDB();
    const collection = db.collection('projects');

    const filter = {};

    // Filter by status if specified
    if (req.query.status && typeof req.query.status === 'string') {
      const normalizedStatus = req.query.status.toLowerCase().trim();
      if (normalizedStatus === 'draft' || normalizedStatus === 'published') {
        filter.status = normalizedStatus;
      }
    }

    // Filter by category
    if (req.query.category && typeof req.query.category === 'string') {
      filter.category = { $regex: new RegExp(`^${req.query.category.trim()}$`, 'i') };
    }

    // Filter by featured flag
    if (req.query.featured !== undefined) {
      filter.featured = req.query.featured === 'true' || req.query.featured === '1';
    }

    // Search filter
    if (req.query.search && typeof req.query.search === 'string') {
      const searchRegex = new RegExp(req.query.search.trim(), 'i');
      filter.$or = [
        { title: searchRegex },
        { shortDescription: searchRegex },
        { slug: searchRegex },
        { technologies: searchRegex },
      ];
    }

    // Pagination
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const [projects, total] = await Promise.all([
      collection
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      collection.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return res.status(200).json({
      success: true,
      count: projects.length,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      data: projects,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Create a new project.
 * POST /api/admin/projects
 */
export async function createProject(req, res, next) {
  try {
    const { isValid, errors, sanitizedData } = validateProjectInput(req.body, false);

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
    }

    const db = getDB();
    const collection = db.collection('projects');

    // Generate unique slug from title
    const slug = await generateUniqueSlug(db, sanitizedData.title);

    const now = new Date();
    const newProject = {
      title: sanitizedData.title,
      slug,
      shortDescription: sanitizedData.shortDescription || '',
      description: sanitizedData.description,
      thumbnail: sanitizedData.thumbnail,
      liveUrl: sanitizedData.liveUrl || '',
      githubUrl: sanitizedData.githubUrl || '',
      technologies: sanitizedData.technologies || [],
      category: sanitizedData.category,
      featured: Boolean(sanitizedData.featured),
      status: sanitizedData.status || 'draft',
      createdAt: now,
      updatedAt: now,
    };

    const insertResult = await collection.insertOne(newProject);
    newProject._id = insertResult.insertedId;

    return res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: newProject,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Update an existing project by ObjectId.
 * PUT /api/admin/projects/:id
 */
export async function updateProject(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID format. Must be a 24-character hexadecimal string.',
      });
    }

    const db = getDB();
    const collection = db.collection('projects');
    const projectObjectId = new ObjectId(id);

    const existing = await collection.findOne({ _id: projectObjectId });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    const { isValid, errors, sanitizedData } = validateProjectInput(req.body, true);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
    }

    // If title is changing, generate a new unique slug
    if (sanitizedData.title && sanitizedData.title !== existing.title) {
      sanitizedData.slug = await generateUniqueSlug(db, sanitizedData.title, projectObjectId);
    }

    sanitizedData.updatedAt = new Date();

    const updatedProject = await collection.findOneAndUpdate(
      { _id: projectObjectId },
      { $set: sanitizedData },
      { returnDocument: 'after' }
    );

    return res.status(200).json({
      success: true,
      message: 'Project updated successfully',
      data: updatedProject,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Admin: Delete a project by ObjectId.
 * DELETE /api/admin/projects/:id
 */
export async function deleteProject(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID format. Must be a 24-character hexadecimal string.',
      });
    }

    const db = getDB();
    const collection = db.collection('projects');

    const result = await collection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Project not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Project deleted successfully',
    });
  } catch (error) {
    next(error);
  }
}
