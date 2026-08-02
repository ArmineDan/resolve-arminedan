output "ec2_public_ip" {
  description = "Public IP address of the EC2 instance"
  value       = aws_instance.app_server.public_ip
}

output "ec2_key_name" {
  description = "Name of the SSH key pair used for the instance"
  value       = aws_instance.app_server.key_name
}