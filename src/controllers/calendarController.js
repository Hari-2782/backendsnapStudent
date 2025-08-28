const Calendar = require('../models/Calendar');
const Session = require('../models/Session');
const MindMap = require('../models/MindMap');
const Quiz = require('../models/Quiz');

class CalendarController {
  /**
   * Create a new calendar entry
   */
  async createCalendarEntry(req, res) {
    try {
      const userId = req.user._id;
      const {
        title,
        subject,
        topic,
        startDate,
        startTime, // Support both startDate and startTime
        endDate,
        endTime,   // Support both endDate and endTime
        duration,
        priority,
        notes,
        color,
        emoji,
        sessionId,
        mindMapId,
        quizId,
        tags,
        recurring,
        reminders,
        metadata
      } = req.body;

      // Validate required fields
      if (!title) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: title'
        });
      }

      if (!startDate && !startTime) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: startDate or startTime'
        });
      }

      // Auto-generate subject and topic if not provided
      const autoSubject = subject || 'Study Session';
      const autoTopic = topic || 'General Review';

      // Handle start date/time
      let actualStartDate = startDate;
      if (startTime && !startDate) {
        actualStartDate = startTime;
      }

      // Handle end date/time
      let actualEndDate = endDate;
      if (endTime && !endDate) {
        actualEndDate = endTime;
      } else if (!actualEndDate) {
        // Calculate end date if not provided
        actualEndDate = new Date(new Date(actualStartDate).getTime() + (duration || 60) * 60000);
      }

      // Check for scheduling conflicts
      const calendarEntry = new Calendar({
        title,
        subject: autoSubject,
        topic: autoTopic,
        startDate: new Date(actualStartDate),
        endDate: new Date(actualEndDate),
        duration: duration || 60,
        priority: priority || 'medium',
        notes,
        color: color || '#2563eb',
        emoji: emoji || '📚',
        userId,
        sessionId,
        mindMapId,
        quizId,
        tags: tags || [],
        recurring: recurring || { enabled: false },
        reminders: reminders || [{ time: 15, type: 'notification' }],
        metadata: {
          ...metadata,
          createdBy: req.user.username || req.user.email
        }
      });

      // Check for conflicts
      const conflict = await calendarEntry.hasConflict();
      if (conflict) {
        return res.status(409).json({
          success: false,
          error: 'Scheduling conflict detected',
          conflict: {
            existingTitle: conflict.title,
            existingTime: conflict.startDate,
            requestedTime: calendarEntry.startDate
          }
        });
      }

      // Save the calendar entry
      const savedEntry = await calendarEntry.save();

      console.log(`✅ Calendar entry created: ${savedEntry.title} for ${savedEntry.startDate}`);

      res.status(201).json({
        success: true,
        calendar: {
          id: savedEntry.id,
          title: savedEntry.title,
          subject: savedEntry.subject,
          topic: savedEntry.topic,
          startDate: savedEntry.startDate,
          endDate: savedEntry.endDate,
          duration: savedEntry.duration,
          priority: savedEntry.priority,
          status: savedEntry.status,
          notes: savedEntry.notes,
          color: savedEntry.color,
          emoji: savedEntry.emoji,
          createdAt: savedEntry.createdAt,
          updatedAt: savedEntry.updatedAt
        }
      });

    } catch (error) {
      console.error('Calendar creation failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create calendar entry',
        details: error.message
      });
    }
  }

  /**
   * Get calendar entries for a user
   */
  async getCalendarEntries(req, res) {
    try {
      const userId = req.user._id;
      const { startDate, endDate, status, subject, limit = 50 } = req.query;

      let query = { userId };

      // Add date range filter
      if (startDate && endDate) {
        query.startDate = { $gte: new Date(startDate) };
        query.endDate = { $lte: new Date(endDate) };
      }

      // Add status filter
      if (status) {
        query.status = status;
      }

      // Add subject filter
      if (subject) {
        query.subject = subject;
      }

      const calendarEntries = await Calendar.find(query)
        .sort({ startDate: 1 })
        .limit(parseInt(limit))
        .populate('sessionId', 'title')
        .populate('mindMapId', 'title topic')
        .populate('quizId', 'title topic');

      console.log(`📅 Retrieved ${calendarEntries.length} calendar entries for user ${userId}`);

      res.status(200).json({
        success: true,
        calendar: calendarEntries.map(entry => ({
          id: entry.id,
          title: entry.title,
          subject: entry.subject,
          topic: entry.topic,
          startDate: entry.startDate,
          endDate: entry.endDate,
          duration: entry.duration,
          priority: entry.priority,
          status: entry.status,
          notes: entry.notes,
          color: entry.color,
          emoji: entry.emoji,
          session: entry.sessionId ? { id: entry.sessionId._id, title: entry.sessionId.title } : null,
          mindMap: entry.mindMapId ? { id: entry.mindMapId._id, title: entry.mindMapId.title, topic: entry.mindMapId.topic } : null,
          quiz: entry.quizId ? { id: entry.quizId._id, title: entry.quizId.title, topic: entry.quizId.topic } : null,
          tags: entry.tags,
          recurring: entry.recurring,
          reminders: entry.reminders,
          metadata: entry.metadata,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt
        }))
      });

    } catch (error) {
      console.error('Failed to get calendar entries:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve calendar entries',
        details: error.message
      });
    }
  }

  /**
   * Get upcoming calendar entries
   */
  async getUpcomingEntries(req, res) {
    try {
      const userId = req.user._id;
      const { limit = 10 } = req.query;

      const upcomingEntries = await Calendar.getUpcoming(userId, parseInt(limit));

      console.log(`📅 Retrieved ${upcomingEntries.length} upcoming entries for user ${userId}`);

      res.status(200).json({
        success: true,
        upcoming: upcomingEntries.map(entry => ({
          id: entry.id,
          title: entry.title,
          subject: entry.subject,
          topic: entry.topic,
          startDate: entry.startDate,
          endDate: entry.endDate,
          duration: entry.duration,
          priority: entry.priority,
          status: entry.status,
          color: entry.color,
          emoji: entry.emoji,
          timeUntil: Math.max(0, Math.floor((entry.startDate - new Date()) / 60000)) // minutes
        }))
      });

    } catch (error) {
      console.error('Failed to get upcoming entries:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve upcoming entries',
        details: error.message
      });
    }
  }

  /**
   * Update a calendar entry
   */
  async updateCalendarEntry(req, res) {
    try {
      const userId = req.user._id;
      const { entryId } = req.params;
      const updateData = req.body;

      // Find the calendar entry
      const calendarEntry = await Calendar.findOne({ _id: entryId, userId });
      if (!calendarEntry) {
        return res.status(404).json({
          success: false,
          error: 'Calendar entry not found'
        });
      }

      // Update the entry
      Object.assign(calendarEntry, updateData);
      
      // Recalculate end date if start date or duration changed
      if (updateData.startDate || updateData.duration) {
        calendarEntry.endDate = new Date(calendarEntry.startDate.getTime() + calendarEntry.duration * 60000);
      }

      // Check for conflicts if time changed
      if (updateData.startDate || updateData.duration) {
        const conflict = await calendarEntry.hasConflict();
        if (conflict) {
          return res.status(409).json({
            success: false,
            error: 'Scheduling conflict detected after update',
            conflict: {
              existingTitle: conflict.title,
              existingTime: conflict.startDate,
              requestedTime: calendarEntry.startDate
            }
          });
        }
      }

      // Save the updated entry
      const updatedEntry = await calendarEntry.save();

      console.log(`✅ Calendar entry updated: ${updatedEntry.title}`);

      res.status(200).json({
        success: true,
        calendar: {
          id: updatedEntry.id,
          title: updatedEntry.title,
          subject: updatedEntry.subject,
          topic: updatedEntry.topic,
          startDate: updatedEntry.startDate,
          endDate: updatedEntry.endDate,
          duration: updatedEntry.duration,
          priority: updatedEntry.priority,
          status: updatedEntry.status,
          notes: updatedEntry.notes,
          color: updatedEntry.color,
          emoji: updatedEntry.emoji,
          updatedAt: updatedEntry.updatedAt
        }
      });

    } catch (error) {
      console.error('Calendar update failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update calendar entry',
        details: error.message
      });
    }
  }

  /**
   * Delete a calendar entry
   */
  async deleteCalendarEntry(req, res) {
    try {
      const userId = req.user._id;
      const { entryId } = req.params;

      const calendarEntry = await Calendar.findOne({ _id: entryId, userId });
      if (!calendarEntry) {
        return res.status(404).json({
          success: false,
          error: 'Calendar entry not found'
        });
      }

      await Calendar.deleteOne({ _id: entryId });

      console.log(`✅ Calendar entry deleted: ${calendarEntry.title}`);

      res.status(200).json({
        success: true,
        message: 'Calendar entry deleted successfully'
      });

    } catch (error) {
      console.error('Calendar deletion failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete calendar entry',
        details: error.message
      });
    }
  }

  /**
   * Get calendar statistics
   */
  async getCalendarStats(req, res) {
    try {
      const userId = req.user._id;
      const { startDate, endDate } = req.query;

      let dateQuery = {};
      if (startDate && endDate) {
        dateQuery = {
          startDate: { $gte: new Date(startDate) },
          endDate: { $lte: new Date(endDate) }
        };
      }

      const stats = await Calendar.aggregate([
        { $match: { userId: userId, ...dateQuery } },
        {
          $group: {
            _id: null,
            totalEntries: { $sum: 1 },
            totalDuration: { $sum: '$duration' },
            averageDuration: { $avg: '$duration' },
            byStatus: {
              $push: '$status'
            },
            byPriority: {
              $push: '$priority'
            },
            bySubject: {
              $push: '$subject'
            }
          }
        }
      ]);

      if (stats.length === 0) {
        return res.status(200).json({
          success: true,
          stats: {
            totalEntries: 0,
            totalDuration: 0,
            averageDuration: 0,
            statusDistribution: {},
            priorityDistribution: {},
            subjectDistribution: {}
          }
        });
      }

      const stat = stats[0];

      // Calculate distributions
      const statusDistribution = stat.byStatus.reduce((acc, status) => {
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});

      const priorityDistribution = stat.byPriority.reduce((acc, priority) => {
        acc[priority] = (acc[priority] || 0) + 1;
        return acc;
      }, {});

      const subjectDistribution = stat.bySubject.reduce((acc, subject) => {
        acc[subject] = (acc[subject] || 0) + 1;
        return acc;
      }, {});

      console.log(`📊 Calendar stats retrieved for user ${userId}`);

      res.status(200).json({
        success: true,
        stats: {
          totalEntries: stat.totalEntries,
          totalDuration: stat.totalDuration,
          averageDuration: Math.round(stat.averageDuration),
          statusDistribution,
          priorityDistribution,
          subjectDistribution
        }
      });

    } catch (error) {
      console.error('Failed to get calendar stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve calendar statistics',
        details: error.message
      });
    }
  }

  /**
   * Bulk create calendar entries (for recurring sessions)
   */
  async bulkCreateEntries(req, res) {
    try {
      const userId = req.user._id;
      const { entries } = req.body;

      if (!Array.isArray(entries) || entries.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Entries array is required and must not be empty'
        });
      }

      const createdEntries = [];
      const errors = [];

      for (const entryData of entries) {
        try {
          const calendarEntry = new Calendar({
            ...entryData,
            userId,
            metadata: {
              ...entryData.metadata,
              createdBy: req.user.username || req.user.email,
              bulkCreated: true
            }
          });

          // Check for conflicts
          const conflict = await calendarEntry.hasConflict();
          if (conflict) {
            errors.push({
              title: entryData.title,
              error: 'Scheduling conflict detected',
              conflict: {
                existingTitle: conflict.title,
                existingTime: conflict.startDate
              }
            });
            continue;
          }

          const savedEntry = await calendarEntry.save();
          createdEntries.push({
            id: savedEntry.id,
            title: savedEntry.title,
            startDate: savedEntry.startDate
          });

        } catch (error) {
          errors.push({
            title: entryData.title,
            error: error.message
          });
        }
      }

      console.log(`✅ Bulk created ${createdEntries.length} calendar entries, ${errors.length} errors`);

      res.status(200).json({
        success: true,
        created: createdEntries,
        errors: errors,
        summary: {
          total: entries.length,
          created: createdEntries.length,
          failed: errors.length
        }
      });

    } catch (error) {
      console.error('Bulk calendar creation failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to bulk create calendar entries',
        details: error.message
      });
    }
  }
}

module.exports = new CalendarController();
