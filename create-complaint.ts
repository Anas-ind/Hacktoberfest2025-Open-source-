import { Request, Response } from 'express';
import User from '../../models/user.models';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Role } from '../../models/index';
import Joi from 'joi';
import { generateOTP, sendEmail } from '../../utils/helpers';
import { StatusCode } from '../../config/status';
import { StatusMsg } from '../../config/statusMsg';
import * as complaintService from '../../services/complaint.services';
import * as organizationService from '../../services/organization.services';
import axios from 'axios';
import prisma from '../../utils/prisma_client';
import { userType } from '../../config/userType';

export const complaintsController = {
  createComplaint: async (req: Request, res: Response) => {
    const ValidationBody = Joi.object({
      device_id: Joi.number().optional(),
      title: Joi.string().optional(),
      description: Joi.string().optional(),
      complaintType: Joi.any().optional(),
    });
    try {
      const { error, value } = ValidationBody.validate(req.body);
      if (error) { return res.status(400).json({ status: StatusCode.ERROR, message: error.details[0].message }); }

      const user = (req as any).user;
      const freshUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (!freshUser) {
        return res.status(404).json({ status: StatusCode.ERROR, message: StatusMsg.USER_NOT_FOUND });
      }
      const { title, description, complaintType, device_id } = value;
      console.log("The arguments are", title, description, user.id, freshUser.organizationId, complaintType, device_id)
      const complaint = await complaintService.createComplaint(title, description, user.id, freshUser.organizationId, complaintType, device_id);

      const fetchAdmin = await prisma.user.findFirst({
        where: {
          organizationId: freshUser.organizationId,
          userType: "ADMIN",
          isActive: true
        }
      });

      const masterUser = await prisma.user.findFirst({
        where: {
          userType: "MASTER",
          isActive: true
        }
      });
      // Send email notification to admin and master
      const recipients = [];
      if (fetchAdmin) {
        recipients.push(fetchAdmin.email);
      }
      if (masterUser) {
        recipients.push(masterUser.email);
      }
      if (recipients.length > 0) {
        const emailSubject = 'New Complaint Created';
        const emailBody = `A new complaint has been created by ${freshUser.name}.\n\nTitle: ${title}\nDescription: ${description}\n\nPlease log in to the admin panel to view and respond to the complaint.`;
        console.log("Thes send ing mails to ", recipients, "zzxzx", emailSubject, "kio", emailBody)

        // await sendEmail({ to: recipients, subject: emailSubject, html: emailBody });

        sendEmail({ to: recipients, subject: emailSubject, html: emailBody })
          .then(() => console.log("✅ Email sent successfully"))
          .catch((err) => console.error("❌ Email sending failed:", err));


      }

      return res.status(201).json({ status: StatusCode.SUCCESS, message: StatusMsg.COMPLAINT_CREATED, data: complaint });
    } catch (err) {
      console.error("Error in createComplaint:", err);
      return res.status(500).json({ status: StatusCode.ERROR, message: StatusMsg.INTERNAL_SERVER_ERROR });
    }
  },
