const mongoose = require('mongoose');

const nodeSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  content: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['concept', 'definition', 'example', 'formula', 'diagram', 'process', 'fact'],
    default: 'concept'
  },
  position: {
    x: {
      type: Number,
      default: 0
    },
    y: {
      type: Number,
      default: 0
    }
  },
  size: {
    width: {
      type: Number,
      default: 200
    },
    height: {
      type: Number,
      default: 100
    }
  },
  style: {
    backgroundColor: {
      type: String,
      default: '#ffffff'
    },
    borderColor: {
      type: String,
      default: '#2563eb'
    },
    textColor: {
      type: String,
      default: '#000000'
    },
    fontSize: {
      type: Number,
      default: 14
    },
    borderRadius: {
      type: Number,
      default: 8
    }
  },
  children: [{
    type: String,
    ref: 'node'
  }],
  parents: [{
    type: String,
    ref: 'node'
  }],
  connections: [{
    targetId: {
      type: String,
      required: true
    },
    label: {
      type: String,
      trim: true
    },
    type: {
      type: String,
      enum: ['contains', 'leads_to', 'related', 'explains', 'depends_on', 'similar_to'],
      default: 'related'
    },
    strength: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5
    }
  }],
  metadata: {
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.8
    },
    sourceImageId: String,
    evidenceIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Evidence'
    }],
    processingMethod: {
      type: String,
      enum: ['vision-enhanced', 'text-based', 'manual', 'ai-generated'],
      default: 'text-based'
    },
    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'intermediate'
    },
    tags: [String],
    lastReviewed: Date,
    reviewCount: {
      type: Number,
      default: 0
    }
  }
}, { _id: false });

const edgeSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  source: {
    type: String,
    required: true
  },
  target: {
    type: String,
    required: true
  },
  label: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['contains', 'leads_to', 'related', 'explains', 'depends_on', 'similar_to'],
    default: 'related'
  },
  style: {
    color: {
      type: String,
      default: '#666666'
    },
    width: {
      type: Number,
      default: 2
    },
    dashArray: {
      type: String,
      default: ''
    }
  },
  metadata: {
    strength: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5
    },
    bidirectional: {
      type: Boolean,
      default: false
    }
  }
}, { _id: false });

const mindMapSchema = new mongoose.Schema({
  mindMapId: {
    type: String,
    required: true,
    unique: true,
    default: () => `mm${Math.random().toString(36).substr(2, 9)}`
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  topic: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: 2000
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  sessionId: {
    type: String,
    ref: 'Session'
  },
  imageId: {
    type: String
  },
  nodes: [nodeSchema],
  edges: [edgeSchema],
  layout: {
    type: {
      type: String,
      enum: ['hierarchical', 'radial', 'force-directed', 'manual'],
      default: 'hierarchical'
    },
    direction: {
      type: String,
      enum: ['top', 'bottom', 'left', 'right'],
      default: 'top'
    },
    spacing: {
      x: {
        type: Number,
        default: 200
      },
      y: {
        type: Number,
        default: 150
      }
    },
    autoLayout: {
      type: Boolean,
      default: true
    }
  },
  settings: {
    showLabels: {
      type: Boolean,
      default: true
    },
    showConnections: {
      type: Boolean,
      default: true
    },
    allowEditing: {
      type: Boolean,
      default: true
    },
    allowSharing: {
      type: Boolean,
      default: false
    },
    maxNodes: {
      type: Number,
      default: 50
    },
    maxDepth: {
      type: Number,
      default: 5
    }
  },
  tags: [{
    type: String,
    trim: true
  }],
  metadata: {
    version: {
      type: String,
      default: '1.0.0'
    },
    createdBy: {
      type: String,
      required: true
    },
    sourceType: {
      type: String,
      enum: ['manual', 'ai-generated', 'imported', 'converted'],
      default: 'manual'
    },
    processingMethod: {
      type: String,
      enum: ['vision-enhanced', 'text-based', 'manual'],
      default: 'manual'
    },
    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'intermediate'
    },
    estimatedStudyTime: {
      type: Number, // Minutes
      default: 30
    },
    lastModified: {
      type: Date,
      default: Date.now
    },
    modificationCount: {
      type: Number,
      default: 0
    }
  },
  statistics: {
    totalNodes: {
      type: Number,
      default: 0
    },
    totalConnections: {
      type: Number,
      default: 0
    },
    averageDepth: {
      type: Number,
      default: 0
    },
    complexity: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient querying
mindMapSchema.index({ userId: 1, createdAt: -1 });
mindMapSchema.index({ userId: 1, subject: 1 });
mindMapSchema.index({ userId: 1, tags: 1 });
mindMapSchema.index({ topic: 'text', title: 'text', description: 'text' });

// Pre-save middleware to update statistics
mindMapSchema.pre('save', function(next) {
  this.statistics.totalNodes = this.nodes.length;
  this.statistics.totalConnections = this.edges.length;
  
  // Calculate average depth
  if (this.nodes.length > 0) {
    const depths = this.nodes.map(node => this.calculateNodeDepth(node.id));
    this.statistics.averageDepth = depths.reduce((sum, depth) => sum + depth, 0) / depths.length;
  }
  
  // Calculate complexity (based on nodes, connections, and depth)
  this.statistics.complexity = Math.min(1, (this.nodes.length * 0.3 + this.edges.length * 0.2 + this.statistics.averageDepth * 0.1));
  
  next();
});

// Method to calculate node depth
mindMapSchema.methods.calculateNodeDepth = function(nodeId, visited = new Set()) {
  if (visited.has(nodeId)) return 0;
  visited.add(nodeId);
  
  const node = this.nodes.find(n => n.id === nodeId);
  if (!node || node.parents.length === 0) return 0;
  
  const parentDepths = node.parents.map(parentId => this.calculateNodeDepth(parentId, visited));
  return Math.max(...parentDepths) + 1;
};

// Method to add node
mindMapSchema.methods.addNode = function(nodeData) {
  if (this.nodes.length >= this.settings.maxNodes) {
    throw new Error('Maximum number of nodes reached');
  }
  
  const newNode = {
    id: nodeData.id || `node_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    title: nodeData.title,
    description: nodeData.description || '',
    content: nodeData.content || '',
    type: nodeData.type || 'concept',
    position: nodeData.position || { x: 0, y: 0 },
    size: nodeData.size || { width: 200, height: 100 },
    style: nodeData.style || {},
    children: nodeData.children || [],
    parents: nodeData.parents || [],
    connections: nodeData.connections || [],
    metadata: {
      ...nodeData.metadata,
      confidence: nodeData.metadata?.confidence || 0.8,
      processingMethod: nodeData.metadata?.processingMethod || 'manual'
    }
  };
  
  this.nodes.push(newNode);
  return newNode;
};

// Method to add edge
mindMapSchema.methods.addEdge = function(edgeData) {
  const newEdge = {
    id: edgeData.id || `edge_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    source: edgeData.source,
    target: edgeData.target,
    label: edgeData.label || '',
    type: edgeData.type || 'related',
    style: edgeData.style || {},
    metadata: edgeData.metadata || {}
  };
  
  this.edges.push(newEdge);
  return newEdge;
};

// Method to get node by ID
mindMapSchema.methods.getNode = function(nodeId) {
  return this.nodes.find(node => node.id === nodeId);
};

// Method to get connected nodes
mindMapSchema.methods.getConnectedNodes = function(nodeId) {
  const connectedIds = new Set();
  
  // Find edges where this node is source or target
  this.edges.forEach(edge => {
    if (edge.source === nodeId) connectedIds.add(edge.target);
    if (edge.target === nodeId) connectedIds.add(edge.source);
  });
  
  return this.nodes.filter(node => connectedIds.has(node.id));
};

// Method to export as JSON
mindMapSchema.methods.exportAsJSON = function() {
  return {
    mindMapId: this.mindMapId,
    title: this.title,
    topic: this.topic,
    description: this.description,
    subject: this.subject,
    nodes: this.nodes,
    edges: this.edges,
    layout: this.layout,
    settings: this.settings,
    tags: this.tags,
    metadata: this.metadata,
    statistics: this.statistics,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

module.exports = mongoose.model('MindMap', mindMapSchema);
