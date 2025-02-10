const User = require('../models/User');

// Get all users
const getAllUsers = async (req, res) => {

    const page = parseInt(req.query.page) || 1; // Default to page 1
    const limit = parseInt(process.env.PAGE_LIMIT) || 10;
    const skip = (page - 1) * limit; // Calculate the number of users to skip

    const searchQuery = req.query.search?.trim() || '';
    let nameFilter = null;

    if (searchQuery) {
        const nameParts = searchQuery.split(/\s+/);
        if (nameParts.length === 2) {
            nameFilter = {
                $or: [
                    { firstName: { $regex: nameParts[0], $options: 'i' } },
                    { lastName: { $regex: nameParts[1], $options: 'i' } }
                ]
            };
        } else {
            nameFilter = {
                $or: [
                    { firstName: { $regex: searchQuery, $options: 'i' } },
                    { lastName: { $regex: searchQuery, $options: 'i' } }
                ]
            };
        }
    }

    try {
        const currentUserId = req.user.id;

        const users = await User.find({
            _id: { $ne: currentUserId }, // Exclude the current user
            ...nameFilter // Include the name filter if it exists
        })

            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const totalUsers = await User.countDocuments({ _id: { $ne: currentUserId } });

        res.status(200).json({
            status: true,
            data: {
                totalUsers,
                totalPages: Math.ceil(totalUsers / limit),
                currentPage: page,
                users
            }
        });
    } catch (error) {
        res.status(400).json({ status: false, message: error.message });
    }
};

const getUserById = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({ status: true, data: user });
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}

module.exports = {
    getAllUsers,
    getUserById
};
