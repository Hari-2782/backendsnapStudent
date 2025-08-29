const Calendar = require('../models/Calendar');
const { v4: uuidv4 } = require('uuid');

/**
 * Create a new calendar task
 * @route POST /api/calendar
 * @access Private
 */
const createTask = async (req, res) => {
  try {
    const {
      title,
      subject,
      topic,
      startDate,
      endDate,
      duration,
      priority,
      status,
      notes,
      color,
      emoji,
      tags,
      recurring,
      reminders,
      metadata
    } = req.body;

    const userId = req.user._id;

    // Validate required fields
    if (!title || !subject || !topic || !startDate) {
      return res.status(400).json({
        success: false,
        error: 'Title, subject, topic, and startDate are required'
      });
    }

    // Validate startDate
    if (isNaN(new Date(startDate).getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid startDate format'
      });
    }

    // Validate duration if provided
    if (duration && (duration < 15 || duration > 480)) {
      return res.status(400).json({
        success: false,
        error: 'Duration must be between 15 and 480 minutes'
      });
    }

    // Calculate endDate if not provided
    const taskStartDate = new Date(startDate);
    const taskDuration = duration || 60;
    const taskEndDate = endDate ? new Date(endDate) : new Date(taskStartDate.getTime() + (taskDuration * 60 * 1000));

    // Check for scheduling conflicts
    const newTask = new Calendar({
      id: `task_${uuidv4()}`,
      title,
      subject,
      topic,
      startDate: taskStartDate,
      endDate: taskEndDate,
      duration: taskDuration,
      priority: priority || 'medium',
      status: status || 'planned',
      notes,
      color: color || '#2563eb',
      emoji: emoji || '📚',
      userId,
      tags: tags || [],
      recurring: recurring || { enabled: false },
      reminders: reminders || [],
      metadata: metadata || {}
    });

    console.log('📅 Creating calendar task:', {
      id: newTask.id,
      title: newTask.title,
      startDate: newTask.startDate,
      endDate: newTask.endDate,
      duration: newTask.duration,
      userId: newTask.userId
    });

    // Check for conflicts
    const conflict = await newTask.hasConflict();
    if (conflict) {
      return res.status(409).json({
        success: false,
        error: 'Task conflicts with existing schedule',
        conflictingTask: {
          id: conflict.id,
          title: conflict.title,
          startDate: conflict.startDate,
          endDate: conflict.endDate
        }
      });
    }

    await newTask.save();
    await newTask.populate('userId', 'username email');

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      task: newTask
    });

  } catch (error) {
    console.error('❌ Create task error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create task',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get all tasks for the authenticated user
 * @route GET /api/calendar
 * @access Private
 */
const getTasks = async (req, res) => {
  try {
    const userId = req.user._id;
    const {
      page = 1,
      limit = 10,
      sortBy = 'startDate',
      sortOrder = 'asc',
      status,
      subject,
      topic,
      priority,
      isCompleted,
      startDate,
      endDate,
      search
    } = req.query;

    // Build query
    const query = { userId };
    
    if (status) query.status = status;
    if (subject) query.subject = subject;
    if (topic) query.topic = topic;
    if (priority) query.priority = priority;
    if (isCompleted !== undefined) query.isCompleted = isCompleted === 'true';
    
    if (startDate || endDate) {
      query.startDate = {};
      if (startDate) query.startDate.$gte = new Date(startDate);
      if (endDate) query.startDate.$lte = new Date(endDate);
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { topic: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query with pagination
    const tasks = await Calendar.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('userId', 'username email');

    // Get total count
    const totalTasks = await Calendar.countDocuments(query);
    const totalPages = Math.ceil(totalTasks / limit);

    res.status(200).json({
      success: true,
      tasks,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalTasks,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (error) {
    console.error('❌ Get tasks error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve tasks'
    });
  }
};

/**
 * Get a single task by ID
 * @route GET /api/calendar/:id
 * @access Private
 */
const getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const task = await Calendar.findOne({ _id: id, userId }).populate('userId', 'username email');

    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    res.status(200).json({
      success: true,
      task
    });

  } catch (error) {
    console.error('❌ Get task by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve task'
    });
  }
};

/**
 * Update a task
 * @route PUT /api/calendar/:id
 * @access Private
 */
const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    const updateData = req.body;

    // Find the task
    const task = await Calendar.findOne({ _id: id, userId });
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    // Check for conflicts if dates are being updated
    if (updateData.startDate || updateData.endDate) {
      const tempTask = new Calendar({
        ...task.toObject(),
        ...updateData,
        _id: task._id
      });
      
      const conflict = await tempTask.hasConflict();
      if (conflict) {
        return res.status(409).json({
          success: false,
          error: 'Updated schedule conflicts with existing tasks',
          conflictingTask: {
            id: conflict.id,
            title: conflict.title,
            startDate: conflict.startDate,
            endDate: conflict.endDate
          }
        });
      }
    }

    // Update the task
    const updatedTask = await Calendar.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('userId', 'username email');

    res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      task: updatedTask
    });

  } catch (error) {
    console.error('❌ Update task error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update task',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete a task
 * @route DELETE /api/calendar/:id
 * @access Private
 */
const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const task = await Calendar.findOne({ _id: id, userId });
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    await Calendar.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Task deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete task error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete task'
    });
  }
};

/**
 * Mark task as completed
 * @route PATCH /api/calendar/:id/complete
 * @access Private
 */
const markTaskCompleted = async (req, res) => {
  try {
    const { id } = req.params;
    const { actualDuration } = req.body;
    const userId = req.user._id;

    const task = await Calendar.findOne({ _id: id, userId });
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    await task.markCompleted(actualDuration);
    await task.populate('userId', 'username email');

    res.status(200).json({
      success: true,
      message: 'Task marked as completed',
      task
    });

  } catch (error) {
    console.error('❌ Mark task completed error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark task as completed'
    });
  }
};

/**
 * Mark task as incomplete
 * @route PATCH /api/calendar/:id/incomplete
 * @access Private
 */
const markTaskIncomplete = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const task = await Calendar.findOne({ _id: id, userId });
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }

    await task.markIncomplete();
    await task.populate('userId', 'username email');

    res.status(200).json({
      success: true,
      message: 'Task marked as incomplete',
      task
    });

  } catch (error) {
    console.error('❌ Mark task incomplete error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark task as incomplete'
    });
  }
};

/**
 * Get weekly progress statistics
 * @route GET /api/calendar/progress/weekly
 * @access Private
 */
const getWeeklyProgress = async (req, res) => {
  try {
    const userId = req.user._id;
    const { weekStart } = req.query;

    // Default to current week if no date provided
    let startDate;
    if (weekStart) {
      startDate = new Date(weekStart);
    } else {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - startDate.getDay()); // Start of week (Sunday)
      startDate.setHours(0, 0, 0, 0);
    }

    const progress = await Calendar.getWeeklyProgress(userId, startDate);
    
    // Format the response
    const weekEnd = new Date(startDate);
    weekEnd.setDate(weekEnd.getDate() + 7);

    res.status(200).json({
      success: true,
      period: {
        start: startDate,
        end: weekEnd,
        type: 'weekly'
      },
      progress: progress[0] || {
        totalTasks: 0,
        completedTasks: 0,
        totalPlannedDuration: 0,
        totalActualDuration: 0,
        totalPlannedTime: 0,
        completedTime: 0,
        completionRate: 0,
        progressPercentage: 0
      }
    });

  } catch (error) {
    console.error('❌ Get weekly progress error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve weekly progress'
    });
  }
};

/**
 * Get monthly progress statistics
 * @route GET /api/calendar/progress/monthly
 * @access Private
 */
const getMonthlyProgress = async (req, res) => {
  try {
    const userId = req.user._id;
    const { monthStart } = req.query;

    // Default to current month if no date provided
    let startDate;
    if (monthStart) {
      startDate = new Date(monthStart);
    } else {
      startDate = new Date();
      startDate.setDate(1); // First day of month
      startDate.setHours(0, 0, 0, 0);
    }

    const progress = await Calendar.getMonthlyProgress(userId, startDate);
    
    // Format the response
    const monthEnd = new Date(startDate);
    monthEnd.setMonth(monthEnd.getMonth() + 1);

    res.status(200).json({
      success: true,
      period: {
        start: startDate,
        end: monthEnd,
        type: 'monthly'
      },
      progress: progress[0] || {
        totalTasks: 0,
        completedTasks: 0,
        totalPlannedDuration: 0,
        totalActualDuration: 0,
        totalPlannedTime: 0,
        completedTime: 0,
        completionRate: 0,
        progressPercentage: 0
      }
    });

  } catch (error) {
    console.error('❌ Get monthly progress error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve monthly progress'
    });
  }
};

/**
 * Get overall user progress
 * @route GET /api/calendar/progress/overall
 * @access Private
 */
const getOverallProgress = async (req, res) => {
  try {
    const userId = req.user._id;

    const progress = await Calendar.getUserProgress(userId);

    res.status(200).json({
      success: true,
      progress: progress[0] || {
        totalTasks: 0,
        completedTasks: 0,
        totalPlannedDuration: 0,
        totalActualDuration: 0,
        totalPlannedTime: 0,
        completedTime: 0,
        subjects: [],
        topics: [],
        completionRate: 0,
        progressPercentage: 0,
        efficiency: 0
      }
    });

  } catch (error) {
    console.error('❌ Get overall progress error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve overall progress'
    });
  }
};

/**
 * Get tasks by subject with progress
 * @route GET /api/calendar/progress/subject/:subject
 * @access Private
 */
const getTasksBySubject = async (req, res) => {
  try {
    const userId = req.user._id;
    const { subject } = req.params;

    const tasks = await Calendar.getTasksBySubject(userId, subject);

    res.status(200).json({
      success: true,
      subject,
      tasks
    });

  } catch (error) {
    console.error('❌ Get tasks by subject error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve tasks by subject'
    });
  }
};

/**
 * Get upcoming tasks
 * @route GET /api/calendar/upcoming
 * @access Private
 */
const getUpcomingTasks = async (req, res) => {
  try {
    const userId = req.user._id;
    const { limit = 10 } = req.query;

    const tasks = await Calendar.getUpcoming(userId, parseInt(limit));

    res.status(200).json({
      success: true,
      tasks
    });

  } catch (error) {
    console.error('❌ Get upcoming tasks error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve upcoming tasks'
    });
  }
};

/**
 * Get tasks by date range
 * @route GET /api/calendar/range
 * @access Private
 */
const getTasksByDateRange = async (req, res) => {
  try {
    const userId = req.user._id;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        error: 'Start date and end date are required'
      });
    }

    const tasks = await Calendar.getByDateRange(
      userId,
      new Date(startDate),
      new Date(endDate)
    );

    res.status(200).json({
      success: true,
      period: {
        start: new Date(startDate),
        end: new Date(endDate)
      },
      tasks
    });

  } catch (error) {
    console.error('❌ Get tasks by date range error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve tasks by date range'
    });
  }
};

/**
 * Bulk update task status
 * @route PATCH /api/calendar/bulk-status
 * @access Private
 */
const bulkUpdateStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const { taskIds, status, isCompleted } = req.body;

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Task IDs array is required'
      });
    }

    const updateData = {};
    if (status !== undefined) updateData.status = status;
    if (isCompleted !== undefined) updateData.isCompleted = isCompleted;
    
    if (isCompleted) {
      updateData.completedAt = new Date();
    }

    const result = await Calendar.updateMany(
      { _id: { $in: taskIds }, userId },
      updateData
    );

    res.status(200).json({
      success: true,
      message: `Updated ${result.modifiedCount} tasks`,
      modifiedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('❌ Bulk update status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to bulk update task status'
    });
  }
};

module.exports = {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  markTaskCompleted,
  markTaskIncomplete,
  getWeeklyProgress,
  getMonthlyProgress,
  getOverallProgress,
  getTasksBySubject,
  getUpcomingTasks,
  getTasksByDateRange,
  bulkUpdateStatus
};
