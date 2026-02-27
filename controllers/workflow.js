import { executor, planner } from '../services/initilizer.js';
import Workflow from '../models/Workflow.js';

export const createWorkflow = async (req, res) => {
    try {
        const { userId, prompt } = req.body;
        const plan = await planner.plan(prompt);

        // const plan = {
        //     steps: [
        //         { tool: 'web_search', input: { query: 'what is apple ?' }, as: 'search1' },
        //         { tool: 'calculator', input: { expr: '23 * (4 + 2) / 3' }, as: 'calc1' },
        //         { tool: 'db_fetch', input: { table: 'users', filter: { id: 1 } }, as: 'user1' },
        //         { tool: 'terminal', input: { cmd: 'ls -la' }, as: 'term1' },
        //         { tool: 'send_email', input: { to: 'prince@example.com', subject: 'Planning failed', body: 'Please try again' }, as: 'email1' },
        //         { tool: 'send_whatsapp', input: { to: '+1234567890', message: 'Planning failed' }, as: 'whatsapp1' }
        //     ]
        // } 

        const workflow = await Workflow.create({
            userId,
            prompt,
            steps: plan?.steps,
            status: 'waiting_approval',
            logs: [
                { status: 'info', message: 'Workflow created', timestamp: Date.now() },
                { status: 'info', message: 'Workflow waiting for approval', timestamp: Date.now() }
            ]
        });

        return res.status(201).json({
            success: true,
            data: {
                workflowId: workflow._id,
                status: workflow.status,
                steps: workflow.steps,
                logs: workflow.logs,
            }
        });
    } catch (err) {
        console.error('Error in workflow creation:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

export const rephraseWorkflowSteps = async (req, res) => {
    try {
        const { id } = req.params;
        const { prompt } = req.body;
        const workflow = await Workflow.findById(id);
        if (!workflow) {
            return res.status(404).json({ success: false, message: 'Workflow not found' });
        }
        if (workflow.status !== 'waiting_approval') {
            return res.status(400).json({ success: false, message: 'Workflow is not in a state that allows rephrasing' });
        }

        const plan = await planner.plan(workflow.prompt, false, true, workflow.logs, prompt, workflow.steps);
        if (!plan) {
            return res.status(400).json({ success: false, message: 'Planning failed' });
        }
        workflow.steps = plan.steps;
        workflow.logs.push({ status: 'info', message: 'Workflow steps rephrased by user', timestamp: Date.now() });
        await workflow.save();
        return res.status(200).json({
            success: true,
            data: {
                workflowId: workflow._id,
                status: workflow.status,
                steps: workflow.steps,
                logs: workflow.logs,
            }
        });
    } catch (err) {
        console.error('Error in workflow rephrasing:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

export const approveWorkflow = async (req, res) => {
    try {
        const { id } = req.params;
        const { env } = req.body;
        const workflow = await Workflow.findById(id);
        if (!workflow) {
            return res.status(404).json({ success: false, message: 'Workflow not found' });
        }

        if (workflow.status !== 'waiting_approval') {
            return res.status(400).json({ success: false, message: 'Workflow is not in a state that allows approval' });
        }
        workflow.status = 'processing';
        workflow.logs.push({ status: 'info', message: 'Workflow approved by user', timestamp: Date.now() });
        workflow.logs.push({ status: 'info', message: 'Workflow waiting for execution', timestamp: Date.now() });
        workflow.logs.push({ status: 'info', message: 'Workflow execution started', timestamp: Date.now() });
        await workflow.save();

        const exicution = await executor.executePlan(workflow.userId, workflow.steps, { env });
        if (exicution.ok === false) {
            workflow.status = 'failed';
            workflow.logs.push({ status: 'error', message: 'Workflow execution failed', timestamp: Date.now() });
            await workflow.save();
            return res.status(500).json({
                success: false,
                message: `Workflow execution failed : ${exicution.error}`,
            });
        }

        workflow.status = 'completed';
        workflow.logs.push({ status: 'success', message: 'Workflow execution completed', timestamp: Date.now() });
        await workflow.save();
        return res.status(200).json({
            success: true,
            data: {
                workflowId: workflow._id,
                status: workflow.status,
                steps: workflow.steps,
                logs: workflow.logs,
            }
        });
    } catch (err) {
        console.error('Error in workflow approval:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

export const rejectWorkflow = async (req, res) => {
    try {
        const { id } = req.params;
        const workflow = await Workflow.findById(id);
        if (!workflow) {
            return res.status(404).json({ success: false, message: 'Workflow not found' });
        }
        workflow.status = 'rejected';
        workflow.logs.push({ status: 'info', message: 'Workflow rejected by user', timestamp: Date.now() });
        await workflow.save();
        return res.status(200).json({
            success: true,
            data: {
                workflowId: workflow._id,
                status: workflow.status,
                logs: workflow.logs,
            },
        });
    } catch (err) {
        console.error('Error in workflow rejection:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

export const getWorkflow = async (req, res) => {
    try {
        const { id } = req.params;
        const workflow = await Workflow.findById(id);
        if (!workflow) return res.status(404).json({ success: false, message: 'Workflow not found' });
        return res.status(200).json({
            success: true,
            data: {
                workflowId: workflow._id,
                status: workflow.status,
                steps: workflow.steps,
                logs: workflow.logs,
                createdAt: workflow.createdAt,
                updatedAt: workflow.updatedAt,
                prompt: workflow.prompt,
            }
        });
    } catch (err) {
        console.error('Error fetching workflow:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};