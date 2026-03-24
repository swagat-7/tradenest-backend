const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});
const PORT = 5000;
const SECRET_KEY = 'secret_key_tradenest'; // In prod, use environment variable

// Initialize Prisma
const prisma = new PrismaClient();

app.use(cors());
app.use(bodyParser.json());

// Root route
app.get('/', (req, res) => {
    res.send('TradeNest Backend is running with Prisma (SQLite)!');
});

// Seed Data helper
const seedData = async () => {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
        console.log("Seeding database...");

        const teamMembers = [
            { id: 1, name: "Admin", email: "admin@tradenest.com", role: "Sales_Admin" },
            { id: 2, name: "Ansuman", email: "am1@tradenest.com", role: "C00" },
            { id: 3, name: "Swagat", email: "sr67@tradenest.com", role: "CFO" },
            { id: 4, name: "Rishabh", email: "rishm17@tradenest.com", role: "CEO" },
            { id: 5, name: "Debaraj", email: "dev18@tradenest.com", role: "CMO" }
        ];

        for (const member of teamMembers) {
            await prisma.user.create({
                data: {
                    email: member.email,
                    password: 'password',
                    name: member.name,
                    role: member.role
                }
            });

            await prisma.teamMember.create({
                data: {
                    name: member.name,
                    email: member.email,
                    role: member.role
                }
            });
        }

        // Seed Leads
        await prisma.lead.createMany({
            data: [
                { name: "Michael Foster", email: "michael@techstart.io", company: "TechStart Inc.", phone: "+1 (555) 123-4567", status: "New", value: "$45,000", source: "Website", avatar: "michael", assignedTo: "Alex Johnson" },
                { name: "Sarah Chen", email: "sarah@innovatelabs.com", company: "Innovate Labs", phone: "+1 (555) 234-5678", status: "Contacted", value: "$28,000", source: "LinkedIn", avatar: "sarah", assignedTo: "Maria Garcia" },
                { name: "David Park", email: "david@globaltech.com", company: "GlobalTech Solutions", phone: "+1 (555) 345-6789", status: "Qualified", value: "$72,000", source: "Referral", avatar: "david", assignedTo: "James Wilson" }
            ]
        });

        // Seed Customers
        await prisma.customer.createMany({
            data: [
                { name: "Acme Corporation", contact: "Tom Harris", email: "tom@acme.com", avatar: "tom", totalSpent: "$145,200", orders: 24, lastOrder: "Dec 15, 2024", status: "Active" },
                { name: "Global Solutions Ltd", contact: "Sarah Mitchell", email: "sarah@globalsolutions.com", avatar: "sarah", totalSpent: "$98,400", orders: 18, lastOrder: "Dec 12, 2024", status: "Active" }
            ]
        });

        // Seed Products
        await prisma.product.createMany({
            data: [
                { name: "Enterprise Suite Pro", sku: "SFT-001", category: "Software", price: 1299, stock: 89, maxStock: 100, revenue: 145200 },
                { name: "Cloud Storage 500GB", sku: "STO-002", category: "Storage", price: 299, stock: 12, maxStock: 200, revenue: 98400 }
            ]
        });

        console.log("Database seeded successfully.");
    }
};

seedData();

// --- AUTHENTICATION ---
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (user && user.password === password) {
            const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, SECRET_KEY, { expiresIn: '1h' });
            res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
        } else {
            res.status(401).json({ message: "Invalid email or password" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ROLES / TEAM ---
app.get('/api/roles', async (req, res) => {
    const team = await prisma.teamMember.findMany();
    res.json(team);
});

app.post('/api/roles', async (req, res) => {
    const { name, email, role } = req.body;
    try {
        const newMember = await prisma.teamMember.create({
            data: { name, email, role }
        });
        // Also create a user login
        await prisma.user.create({
            data: { name, email, role, password: 'password' }
        });
        res.status(201).json(newMember);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.delete('/api/roles/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        // Get member to find email
        const member = await prisma.teamMember.findUnique({ where: { id } });
        if (member) {
            await prisma.teamMember.delete({ where: { id } });
            // Try to delete user by email if possible, or just ignore for now as id might differ
            try {
                await prisma.user.delete({ where: { email: member.email } });
            } catch (e) { }
        }
        res.json({ message: "Deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- LEADS ---
app.get('/api/leads', async (req, res) => {
    const leads = await prisma.lead.findMany();
    // Convert ID to number for frontend compatibility if needed, though Prisma uses Int
    res.json(leads);
});

app.post('/api/leads', async (req, res) => {
    try {
        const newLead = await prisma.lead.create({
            data: req.body
        });
        res.status(201).json(newLead);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.put('/api/leads/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const updatedLead = await prisma.lead.update({
            where: { id },
            data: req.body
        });
        res.json(updatedLead);
    } catch (error) {
        res.status(404).json({ message: "Lead not found" });
    }
});

app.delete('/api/leads/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        await prisma.lead.delete({ where: { id } });
        res.json({ message: "Deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- CUSTOMERS ---
app.get('/api/customers', async (req, res) => {
    const customers = await prisma.customer.findMany();
    res.json(customers);
});

app.post('/api/customers', async (req, res) => {
    try {
        const newCustomer = await prisma.customer.create({
            data: req.body
        });
        res.status(201).json(newCustomer);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.delete('/api/customers/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        await prisma.customer.delete({ where: { id } });
        res.json({ message: "Deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- PRODUCTS ---
app.get('/api/products', async (req, res) => {
    const products = await prisma.product.findMany();
    res.json(products);
});

app.post('/api/products', async (req, res) => {
    try {
        const newProduct = await prisma.product.create({
            data: req.body
        });
        res.status(201).json(newProduct);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.put('/api/products/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const updatedProduct = await prisma.product.update({
            where: { id },
            data: req.body
        });
        res.json(updatedProduct);
    } catch (error) {
        res.status(404).json({ message: "Product not found" });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        await prisma.product.delete({ where: { id } });
        res.json({ message: "Deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ORDERS ---
app.get('/api/orders', async (req, res) => {
    const orders = await prisma.order.findMany();
    res.json(orders);
});

app.post('/api/orders', async (req, res) => {
    try {
        const orderData = req.body;
        if (!orderData.id) orderData.id = `INV-${Date.now()}`;

        const newOrder = await prisma.order.create({
            data: orderData
        });
        res.status(201).json(newOrder);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.put('/api/orders/:id', async (req, res) => {
    const id = req.params.id; // String ID
    try {
        const updatedOrder = await prisma.order.update({
            where: { id },
            data: req.body
        });
        res.json(updatedOrder);
    } catch (error) {
        res.status(404).json({ message: "Order not found" });
    }
});

app.delete('/api/orders/:id', async (req, res) => {
    const id = req.params.id;
    try {
        await prisma.order.delete({ where: { id } });
        res.json({ message: "Deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- DASHBOARD ---
app.get('/api/dashboard', async (req, res) => {
    try {
        const deals = await prisma.deal.findMany({ orderBy: { createdAt: 'desc' }, include: { user: true } });

        const totalDealValue = deals.reduce((acc, deal) => acc + (deal.value || 0), 0);
        const activeDeals = deals.length;
        const wonDeals = deals.filter(d => d.stage === 'won').length;
        const winRate = activeDeals > 0 ? (wonDeals / activeDeals) * 100 : 0;

        const stats = {
            totalDealValue: totalDealValue,
            avgDealValue: activeDeals > 0 ? totalDealValue / activeDeals : 0,
            winRate: parseFloat(winRate.toFixed(1)),
            activeDeals: activeDeals
        };

        const stages = [
            { key: 'lead', name: "Leads", count: 0, value: 0, color: "from-info to-cyan-400" },
            { key: 'qualified', name: "Qualified", count: 0, value: 0, color: "from-primary to-accent" },
            { key: 'proposal', name: "Proposal", count: 0, value: 0, color: "from-warning to-orange-400" },
            { key: 'negotiation', name: "Negotiation", count: 0, value: 0, color: "from-neon-pink to-rose-400" },
            { key: 'won', name: "Won", count: 0, value: 0, color: "from-success to-emerald-400" },
        ];

        stages.forEach(s => {
            const stageDeals = deals.filter(d => d.stage === s.key);
            s.count = stageDeals.length;
            const sVal = stageDeals.reduce((a, b) => a + (b.value || 0), 0);
            s.value = `$${sVal >= 1000000 ? (sVal / 1000000).toFixed(1) + 'M' : (sVal / 1000).toFixed(1) + 'K'}`;
            s.percentage = activeDeals > 0 ? Math.round((s.count / activeDeals) * 100) : 0;
        });

        const rawData = deals.filter(d => d.stage === 'won' || d.stage === 'negotiation').map(d => ({
            time: d.createdAt,
            revenue: d.value
        }));

        const users = await prisma.user.findMany({ include: { deals: true } });
        const topSalespersons = users
            .filter(u => u.role && u.role.toLowerCase().includes('sales'))
            .map(u => {
                const userDeals = u.deals || [];
                const revenue = userDeals.filter(d => d.stage === 'won').reduce((a, b) => a + (b.value || 0), 0);
                return {
                    name: u.name,
                    avatar: u.avatar || u.name.split(" ")[0].toLowerCase(),
                    revenue: `$${revenue.toLocaleString()}`,
                    deals: userDeals.length,
                    target: 100,
                    role: u.role,
                    rawRev: revenue
                };
            })
            .sort((a, b) => b.rawRev - a.rawRev)
            .slice(0, 5);

        const productsDb = await prisma.product.findMany({ orderBy: { revenue: 'desc' }, take: 5 });
        const topProducts = productsDb.map(p => ({
            name: p.name,
            revenue: `$${p.revenue.toLocaleString()}`,
            units: p.stock,
            change: Math.floor(Math.random() * 30) - 10,
            category: p.category
        }));

        let activitiesDb = await prisma.activity.findMany({ orderBy: { timestamp: 'desc' }, take: 6 });
        const recentActivities = activitiesDb.map(a => {
            const diffInMins = Math.floor((new Date() - new Date(a.timestamp)) / 60000);
            let timeStr = diffInMins < 60 ? `${diffInMins} minutes ago` : `${Math.floor(diffInMins / 60)} hours ago`;
            if (diffInMins === 0) timeStr = "Just now";
            return {
                id: a.id,
                type: a.type,
                title: a.description.split(" - ")[0] || a.description,
                description: a.description.split(" - ")[1] || "",
                time: timeStr
            };
        });

        res.json({ stats, pipeline: stages, rawData, topSalespersons, topProducts, recentActivities });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- DEALS (PIPELINE) ---
app.get('/api/deals', async (req, res) => {
    try {
        const deals = await prisma.deal.findMany();
        res.json(deals);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/deals', async (req, res) => {
    try {
        const { company, value, contact, stage, daysInStage, probability } = req.body;

        // Parse value from string if needed, remove '$' and ','
        let numericValue = 0;
        if (typeof value === 'string') {
            numericValue = parseFloat(value.replace(/[^0-9.-]+/g, ""));
        } else {
            numericValue = parseFloat(value);
        }

        const newDeal = await prisma.deal.create({
            data: {
                company,
                value: numericValue,
                contact,
                stage: stage || 'lead',
                daysInStage: daysInStage ? parseInt(daysInStage) : 0,
                probability: probability ? parseInt(probability) : 0
            }
        });
        await prisma.activity.create({
            data: {
                type: 'new_lead',
                description: `New lead created - ${company}`,
            }
        });
        io.emit('dashboard_update');
        res.status(201).json(newDeal);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.put('/api/deals/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const { stage, value, daysInStage, probability, company, contact } = req.body;
    try {
        const data = {};
        if (stage !== undefined) data.stage = stage;
        if (company !== undefined) data.company = company;
        if (contact !== undefined) data.contact = contact;
        if (daysInStage !== undefined) data.daysInStage = parseInt(daysInStage);
        if (probability !== undefined) data.probability = parseInt(probability);
        if (value !== undefined) {
            if (typeof value === 'string') {
                data.value = parseFloat(value.replace(/[^0-9.-]+/g, ""));
            } else {
                data.value = parseFloat(value);
            }
        }

        const updatedDeal = await prisma.deal.update({
            where: { id },
            data
        });

        if (stage === 'won') {
            await prisma.activity.create({
                data: {
                    type: 'deal_won',
                    description: `Deal won - ${updatedDeal.company} ($${updatedDeal.value})`,
                }
            });
        }

        io.emit('dashboard_update');
        res.json(updatedDeal);
    } catch (error) {
        console.error(error);
        res.status(404).json({ message: "Deal not found" });
    }
});

app.delete('/api/deals/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        await prisma.deal.delete({ where: { id } });
        io.emit('dashboard_update');
        res.json({ message: "Deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- REPORTS ---
app.get('/api/reports', async (req, res) => {
    try {
        const reports = await prisma.report.findMany({
            orderBy: { createdAt: 'desc' } // Ensure recent first
        });
        res.json(reports);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/reports', async (req, res) => {
    try {
        const { name, category, frequency } = req.body;
        const newReport = await prisma.report.create({
            data: {
                name,
                category,
                frequency,
                lastRun: null
            }
        });
        res.status(201).json(newReport);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.put('/api/reports/:id/run', async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const updatedReport = await prisma.report.update({
            where: { id },
            data: { lastRun: new Date() }
        });
        res.json(updatedReport);
    } catch (error) {
        res.status(404).json({ message: "Report not found" });
    }
});

app.delete('/api/reports/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        await prisma.report.delete({ where: { id } });
        res.json({ message: "Deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- SETTINGS / BILLING ENDPOINTS ---

app.post('/api/profile/:id/password', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { currentPassword, newPassword } = req.body;

        const user = await prisma.user.findUnique({ where: { id } });
        if (!user || user.password !== currentPassword) {
            return res.status(400).json({ error: "Invalid current password" });
        }

        await prisma.user.update({
            where: { id },
            data: { password: newPassword }
        });
        res.json({ message: "Password updated successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/profile/:id/2fa', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await prisma.user.update({
            where: { id },
            data: { twoFactorEnabled: true }
        });
        res.json({ message: "2FA enabled" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/team', async (req, res) => {
    try {
        const team = await prisma.user.findMany({
            select: { id: true, name: true, email: true, role: true, avatar: true }
        });
        res.json(team);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/team', async (req, res) => {
    try {
        const { name, email, role } = req.body;
        const newMember = await prisma.user.create({
            data: {
                name, email, role, password: "temppassword123", avatar: name.split(" ")[0].toLowerCase()
            }
        });
        res.json(newMember);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/team/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const updated = await prisma.user.update({
            where: { id },
            data: req.body
        });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/profile/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        let user = await prisma.user.findUnique({ where: { id }, include: { notifications: true, company: true } });
        if (!user) {
            // fallback: return first user or empty
            user = await prisma.user.findFirst({ include: { notifications: true, company: true } });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/profile/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { name, email, phone, role, avatar, twoFactorEnabled } = req.body;
        const updated = await prisma.user.update({
            where: { id },
            data: { name, email, phone, role, avatar, twoFactorEnabled }
        });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/profile/:id/notifications', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const data = req.body;

        const existing = await prisma.notificationSetting.findUnique({ where: { userId: id } });
        let updated;
        if (existing) {
            updated = await prisma.notificationSetting.update({ where: { userId: id }, data });
        } else {
            updated = await prisma.notificationSetting.create({ data: { ...data, userId: id } });
        }
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/company/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const data = req.body;
        // Upsert company
        const existing = await prisma.company.findUnique({ where: { id } });
        let updated;
        if (existing) {
            updated = await prisma.company.update({ where: { id }, data });
        } else {
            updated = await prisma.company.create({ data: { ...data, id } }); // Optional: manually setting id
        }
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/subscription', async (req, res) => {
    try {
        const sub = await prisma.subscription.findFirst();
        res.json(sub);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/subscription', async (req, res) => {
    try {
        const data = req.body;
        let sub = await prisma.subscription.findFirst();
        if (sub) {
            sub = await prisma.subscription.update({ where: { id: sub.id }, data });
        } else {
            sub = await prisma.subscription.create({ data });
        }
        res.json(sub);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/app-invoices', async (req, res) => {
    try {
        const invs = await prisma.appInvoice.findMany();
        res.json(invs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
