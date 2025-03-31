const Message = require('../models/Message');

const mongoose = require('mongoose');

// Get chat user list
const getChatUserList = async (req, res) => {

    const authUserId = req.user.id; // Authenticated user ID
    const page = parseInt(req.query.page) || 1; // Page number
    const limit = parseInt(process.env.PAGE_LIMIT) || 10; // Results per page

    const skip = (page - 1) * limit; // Calculate skip for pagination

    const searchQuery = req.query.search?.trim() || '';
    let nameFilter = null;

    if (searchQuery) {
        const nameParts = searchQuery.split(/\s+/);
        if (nameParts.length === 2) {
            // User entered full name (first and last)
            nameFilter = {
                'userDetails.firstName': { $regex: `^${nameParts[0]}`, $options: 'i' },
                'userDetails.lastName': { $regex: `^${nameParts[1]}`, $options: 'i' }
            };
        } else {
            // User entered only one name, search in both first and last name
            nameFilter = {
                $or: [
                    { 'userDetails.firstName': { $regex: `^${searchQuery}`, $options: 'i' } },
                    { 'userDetails.lastName': { $regex: `^${searchQuery}`, $options: 'i' } }
                ]
            };
        }
    }

    try {
        const usersWithMessages = await Message.aggregate([
            {
                $match: {
                    $or: [
                        { from_user_id: new mongoose.Types.ObjectId(authUserId) },
                        { to_user_id: new mongoose.Types.ObjectId(authUserId) }
                    ]
                }
            },
            {
                $group: {
                    _id: {
                        $cond: [
                            { $eq: ['$from_user_id', new mongoose.Types.ObjectId(authUserId)] },
                            '$to_user_id',
                            '$from_user_id'
                        ]
                    },
                    latestMessage: { $last: '$$ROOT' }, // Get the latest message,
                    unreadCount: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ['$to_user_id', new mongoose.Types.ObjectId(authUserId)] },
                                        { $eq: ['$is_read', false] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: 'users', // Assuming the users collection is named 'users'
                    localField: '_id',
                    foreignField: '_id',
                    as: 'userDetails'
                }
            },
            {
                $unwind: '$userDetails'
            },
            /* ...(searchQuery
                ? [
                    {
                        $match: {
                            $or: [
                                { 'userDetails.firstName': { $regex: searchQuery, $options: 'i' } },
                                { 'userDetails.lastName': { $regex: searchQuery, $options: 'i' } }
                            ]
                        }
                    }
                ]
                : []), */
            ...(searchQuery ? [{ $match: nameFilter }] : []),
            {
                $project: {
                    _id: 0,
                    userId: '$_id',
                    firstName: '$userDetails.firstName',
                    lastName: '$userDetails.lastName',
                    latestMessage: {
                        content: '$latestMessage.content',
                        createdAt: '$latestMessage.createdAt'
                    },
                    unreadCount: 1
                }
            },
            {
                $sort: {
                    'latestMessage.createdAt': -1  // Sort by latest message date in descending order
                }
            },
            { $skip: skip },
            { $limit: limit }
        ]);

        const totalUsers = await Message.aggregate([
            {
                $match: {
                    $or: [
                        { from_user_id: new mongoose.Types.ObjectId(authUserId) },
                        { to_user_id: new mongoose.Types.ObjectId(authUserId) }
                    ]
                }
            },
            {
                $group: {
                    _id: {
                        $cond: [
                            { $eq: ['$from_user_id', new mongoose.Types.ObjectId(authUserId)] },
                            '$to_user_id',
                            '$from_user_id'
                        ]
                    }
                }
            },
            {
                $count: 'total'
            }
        ]);

        let messages = [];
        if (totalUsers.length > 0) {
            userMessage = usersWithMessages[0];
            if (userMessage) {
                messages = await getMessagesBetweenUsers(req.user.id, userMessage.userId);
            }
        }

        res.status(200).json({
            status: true,
            data: {
                totalUsers,
                totalPages: Math.ceil(totalUsers / limit),
                currentPage: page,
                users: usersWithMessages,
                message_data: messages
            }
        });

    } catch (error) {
        console.error('Error fetching users with messages:', error);
        res.status(400).json({
            status: false,
            message: 'Failed to fetch users with messages',
            error: error.message
        });
    }

};

function getUnreadCount(loggedInUserId, fromUserId) {
    return Message.countDocuments({
        to_user_id: loggedInUserId,
        from_user_id: fromUserId,
        is_read: false
    });
}

async function getMessagesBetweenUsers(loggedInUserId, fromUserId) {

    let limit = process.env.PAGE_LIMIT
    let messages = [];

    // First, get total unread count and the ID of the first unread message
    const unreadCount = await getUnreadCount(loggedInUserId, fromUserId)

    let query = {
        $or: [
            { from_user_id: fromUserId, to_user_id: loggedInUserId },
            { from_user_id: loggedInUserId, to_user_id: fromUserId }
        ]
    };

    const totalMessages = await Message.countDocuments(query);
    let hasMore = false;

    if (unreadCount > 0) {

        hasMore = unreadCount > limit;

        const firstUnreadMessage = await Message.findOne({
            to_user_id: loggedInUserId,
            from_user_id: fromUserId,
            is_read: false
        }).sort({ createdAt: 1 });

        // Load the latest 20 messages
        messages = await Message.find({
            ...query,
            createdAt: { $gte: firstUnreadMessage.createdAt }
        })
            .sort({ createdAt: 1 })
            .limit(limit)
            .populate('from_user_id', 'firstName lastName')
            .populate('to_user_id', 'firstName lastName');


        if (messages.length < limit) {

            const additionalMessages = await Message.find({
                ...query,
                createdAt: { $lt: firstUnreadMessage.createdAt }
            })
                .populate('from_user_id', 'firstName lastName')
                .populate('to_user_id', 'firstName lastName')
                .sort({ createdAt: -1 })
                .limit(limit - messages.length);

            messages = messages.concat(additionalMessages).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        }

    } else {
        messages = await Message.find(query)
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('from_user_id', 'firstName lastName')
            .populate('to_user_id', 'firstName lastName')

        messages = messages.reverse();
    }

    return {
        messages,
        unreadCount,
        totalMessages,
        hasMore
    };
}

// Get messages between two users
const getMessages = async (req, res) => {
    try {
        const messages = await getMessagesBetweenUsers(req.user.id, req.params.userId);
        res.status(200).json({
            status: true,
            data: {
                message_data: messages
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Create a new message
const createMessage = async (req, res) => {
    try {
        const { content, to_user_id } = req.body;
        const files = req.files;
        const type = files && files.length > 0 ? 'file' : 'text';

        let media = []

        if (files && files.length > 0) {
            media = files.map(file => ({
                filename: file.filename,
                file_type: file.mimetype
            }));
        }

        const message = new Message({
            content,
            from_user_id: req.user.id,
            to_user_id,
            type,
            media
        });

        await message.save();
        await message.populate('from_user_id', 'username');
        await message.populate('to_user_id', 'username');

        res.status(201).json({ status: true, data: {media, filePath: 'storage/upload/chat'} });
    } catch (error) {
        res.status(400).json({ status: false, message: error.message });
    }
};

// Update messages read status
const updateMessagesReadStatus = async (req, res) => {
    try {
        const { lastMessageId } = req.body;
        const fromUserId = req.params.userId; // The sender whose messages we're marking as read
        const toUserId = req.user.id; // The current authenticated user (receiver)

        // Add validation for lastMessageId
        if (!lastMessageId) {
            return res.status(400).json({
                status: false,
                message: 'lastMessageId is required'
            });
        }

        // Validate if lastMessageId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(lastMessageId)) {
            return res.status(400).json({
                status: false,
                message: 'Invalid lastMessageId format'
            });
        }

        const lastMessage = await Message.findById(lastMessageId);
        
        // Check if message exists
        if (!lastMessage) {
            return res.status(404).json({
                status: false,
                message: 'Message not found'
            });
        }

        const query = {
            from_user_id: fromUserId,
            to_user_id: toUserId,
            is_read: false,
            createdAt: { $lte: lastMessage.createdAt }
        }

        const messagesToUpdate = await Message.find(query).select('_id');
        const updatedMessageIds = messagesToUpdate.map(msg => msg._id)

        // Update specific unread messages from this sender to this receiver
        await Message.updateMany(
            query,
            {
                $set: { is_read: true }
            }
        );

        res.status(200).json({
            status: true,
            message: 'Messages marked as read',
            updatedCount: updatedMessageIds.length,
            updatedMessageIds: updatedMessageIds
        });

    } catch (error) {
        console.error('Error updating message read status:', error);
        res.status(500).json({
            status: false,
            message: 'Failed to update message read status',
            error: error.message
        });
    }
};

const loadMoreMessages = async (req, res) => {
    try {
        const loggedInUserId = req.user.id;
        const fromUserId = req.params.userId;
        const lastMessageId = req.query.lastMessageId;

        const limit = process.env.PAGE_LIMIT;
        let hasMore = false;

        const unreadCount = await getUnreadCount(loggedInUserId, fromUserId)

        if (unreadCount > 0 && unreadCount > limit) {
            hasMore = true;
        }

        // Fetch the last message to get its createdAt timestamp
        const lastMessage = await Message.findById(lastMessageId).select('createdAt');

        let query = {
            $or: [
                { from_user_id: fromUserId, to_user_id: loggedInUserId },
                { from_user_id: loggedInUserId, to_user_id: fromUserId }
            ]
        };

        const messages = await Message.find({
            ...query,
            createdAt: { $gte: lastMessage.createdAt },
            _id: { $ne: lastMessageId },
        })
            .sort({ createdAt: 1 })
            .limit(limit)
            .populate('from_user_id', 'firstName lastName')
            .populate('to_user_id', 'firstName lastName');

        res.status(200).json({
            status: true,
            data: {
                messages,
                hasMore
            }
        });

    } catch (error) {
        console.error('Error loading more messages:', error);
        res.status(500).json({
            status: false,
            message: 'Failed to load more messages',
            error: error.message
        });
    }
}

const getUnreadCountMessage = async (req, res) => {
    try {
        const loggedInUserId = req.user.id;
        const fromUserId = req.params.userId;

        const unreadCount = await getUnreadCount(loggedInUserId, fromUserId)

        res.status(200).json({
            status: true,
            data: { unreadCount }
        });
    } catch (error) {
        console.error('Error getting unread count:', error);
        res.status(500).json({
            status: false,
            message: 'Failed to get unread count',
            error: error.message
        });
    }
}

const loadMoreOldMessages = async (req, res) => {
    try {
        const loggedInUserId = req.user.id;
        const fromUserId = req.params.userId;
        const firstMessageId = req.query.firstMessageId;

        const limit = process.env.PAGE_LIMIT;
        let hasMore = false;
        messages = [];

        // Fetch the last message to get its createdAt timestamp
        const firstMessage = await Message.findById(firstMessageId).select('createdAt');

        let query = {
            $or: [
                { from_user_id: fromUserId, to_user_id: loggedInUserId },
                { from_user_id: loggedInUserId, to_user_id: fromUserId }
            ]
        };

        if (firstMessage) {
            messages = await Message.find({
                ...query,
                createdAt: { $lte: firstMessage.createdAt },
                _id: { $ne: firstMessageId },
            })
                .sort({ createdAt: -1 })
                .limit(limit)
                .populate('from_user_id', 'firstName lastName')
                .populate('to_user_id', 'firstName lastName');
        } else {
            // console.log('no old message');
        }

        if (messages.length > 0) {
            hasMore = true;
        }

        res.status(200).json({
            status: true,
            data: {
                messages,
                hasMore
            }
        });

    } catch (error) {
        console.error('Error loading more messages:', error);
        res.status(500).json({
            status: false,
            message: 'Failed to load more messages',
            error: error.message
        });
    }
}

module.exports = {
    getMessages,
    createMessage,
    getChatUserList,
    updateMessagesReadStatus,
    loadMoreMessages,
    loadMoreOldMessages,
    getUnreadCountMessage
};