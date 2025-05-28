import { generateInstructorId } from '../utils/idGenerator';

export class InstructorService {
  async createInstructor(instructorData: any) {
    try {
      // Generate the correct TIN format ID
      const instructorId = generateInstructorId();
      
      // Create the instructor profile with the TIN ID as userId
      const instructorProfile = {
        ...instructorData,
        userId: instructorId, // Store the TIN format ID in userId field
      };

      // Your existing database save logic here
      return instructorProfile;
    } catch (error) {
      throw new Error(`Failed to create instructor: ${error.message}`);
    }
  }
} 