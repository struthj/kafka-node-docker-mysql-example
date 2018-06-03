
DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `products` (
  `id` mediumint(9) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `price` varchar(7) NOT NULL,
  `sizes` varchar(255) NOT NULL,
  `category` varchar(255) NOT NULL,
  `subcategory` varchar(255) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `collection` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=20 DEFAULT CHARSET=latin1;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
INSERT INTO `products` VALUES (1,'Nike Air Max','76.00','9,10,11,12,13','Running Shoe','Mens Running Shoe','The Nike Air Max 2017 Mens Running Shoe features a seamless Flymesh upper for support and breathability','Nike Classic'), (2,'Lebron 15','105.00','10,11,12,13,14,15','Basketball Shoe','Mens Shoe','TThe LeBron 15 Basketball Shoe features a new kind of Flyknit','Lebron');
UNLOCK TABLES;
