import mongoose from 'mongoose';

const logSchema = new mongoose.Schema({
    status: {
        type: String,
        enum: [
            "info",
            "warning",
            "error",
            "success"
        ],
        default: "info"
    },
    message: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

const StepSchema = new mongoose.Schema({
    tool: {
        type: String,
        required: true
    },
    input: {
        type: Object,
        required: true
    },
    status: {
        type: String,
        enum: [
            "pending",
            "processing",
            "completed",
            "failed",
        ],
        default: "pending"
    },
    result: {
        type: Object,
        default: null
    },
    error: {
        type: String,
        default: null
    }
}, { _id: false });

const WorkflowSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    prompt: {
        type: String,
        required: true
    },
    steps: {
        type: [StepSchema],
        default: []
    },
    status: {
        type: String,
        enum: [
            "created",
            "waiting_approval",
            "processing",
            "completed",
            "failed",
            "rejected"
        ],
        default: "created"
    },
    logs: {
        type: [logSchema],
        default: []
    }
}, { timestamps: true });

export default mongoose.model("Workflow", WorkflowSchema);